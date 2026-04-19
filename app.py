# Super Market Sales G - Complete Working Application with Indian Rupees
import os
import json
import secrets
from datetime import datetime, timedelta
import warnings
import subprocess
import zipfile
warnings.filterwarnings('ignore')

from flask import Flask, render_template, request, jsonify, session, send_file, redirect, url_for
from flask_cors import CORS
import pandas as pd
import numpy as np
import plotly.graph_objs as go
import plotly.utils
import io

# Google OAuth
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Machine Learning
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score

# PDF Generation
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
inch = 72  # default fallback in points
try:
    from reportlab.lib.units import inch as _inch
    inch = _inch
except ImportError:
    pass
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

# Text to Speech
import pyttsx3

from dotenv import load_dotenv
load_dotenv()

# Fix for Kaggle API environment variables
if os.getenv('KAGGLE_API_TOKEN') and not os.getenv('KAGGLE_KEY'):
    os.environ['KAGGLE_KEY'] = os.getenv('KAGGLE_API_TOKEN')

# Initialize Flask App
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))
CORS(app)

APP_VERSION = '1.0.0'
START_TIME = datetime.now()

# Create directories
os.makedirs('uploads', exist_ok=True)
os.makedirs('models', exist_ok=True)
os.makedirs('reports', exist_ok=True)
os.makedirs('data', exist_ok=True)

from functools import wraps

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('index', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

# ============================================================================
# INDIAN RUPEE FORMATTING
# ============================================================================

def format_indian_rupee(amount):
    """Format amount in Indian Rupee format (₹)"""
    if amount == 0:
        return "₹0"
    amount = float(amount)
    # Convert to Indian numbering system (lakhs, crores)
    if amount >= 10000000:  # 1 crore = 1,00,00,000
        crore = amount / 10000000
        return f"₹{crore:.2f} Cr"
    elif amount >= 100000:  # 1 lakh = 1,00,000
        lakh = amount / 100000
        return f"₹{lakh:.2f} L"
    else:
        return f"₹{amount:,.2f}"

# ============================================================================
# KAGGLE DATASET MANAGER
# ============================================================================

class KaggleDatasetManager:
    def __init__(self):
        self.datasets = {
            'supermarket_sales': {
                'name': 'Supermarket Sales',
                'url': 'aungpyaeap/supermarket-sales',
                'description': 'Supermarket sales data with product lines, customer ratings',
                'file': 'supermarket_sales.csv',
                'expected_file': 'supermarket_sales.csv'
            },
            'walmart_sales': {
                'name': 'Walmart Sales',
                'url': 'aslanahmedov/walmart-sales-forecast',
                'description': 'Weekly sales data from 45 Walmart stores',
                'file': 'walmart_sales.csv',
                'expected_file': 'Walmart.csv'
            },
            'bigmart_sales': {
                'name': 'BigMart Sales',
                'url': 'brijbhushannanda1979/bigmart-sales-data',
                'description': '8,523 products across 10 stores',
                'file': 'bigmart_sales.csv',
                'expected_file': 'Train.csv'
            }
        }
    
    def download_dataset(self, dataset_key):
        """Download dataset from Kaggle"""
        if dataset_key not in self.datasets:
            return {'status': 'error', 'message': 'Dataset not found'}
        
        # Ensure environment variables are set for subprocess
        env = os.environ.copy()
        if os.getenv('KAGGLE_USERNAME'):
            env['KAGGLE_USERNAME'] = os.getenv('KAGGLE_USERNAME')
        if os.getenv('KAGGLE_KEY'):
            env['KAGGLE_KEY'] = os.getenv('KAGGLE_KEY')
        
        # Also try to point to local kaggle.json if in project root
        if os.path.exists('kaggle.json') and 'KAGGLE_CONFIG_DIR' not in env:
            env['KAGGLE_CONFIG_DIR'] = os.getcwd()

        dataset = self.datasets[dataset_key]
        dataset_url = dataset['url']
        
        try:
            # Check if kaggle is installed
            result = subprocess.run("kaggle --version", shell=True, capture_output=True, env=env)
            if result.returncode != 0:
                return {'status': 'error', 'message': 'Kaggle CLI not installed or not in PATH.'}
            
            # Download using kaggle API
            cmd = f"kaggle datasets download -d {dataset_url} -p data/ --force"
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env)
            
            if res.returncode != 0:
                error_msg = res.stderr.strip() or res.stdout.strip() or "Unknown error"
                return {'status': 'error', 'message': f'Kaggle Error: {error_msg}'}
            
            # Unzip the file
            zip_file = f"data/{dataset_url.split('/')[-1]}.zip"
            if os.path.exists(zip_file):
                with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                    zip_ref.extractall('data/')
                os.remove(zip_file)
                
                # Find and rename the CSV file
                expected = dataset.get('expected_file')
                renamed = False
                
                # Check for exact match first
                if expected and os.path.exists(f"data/{expected}"):
                    if os.path.exists(f"data/{dataset['file']}"):
                        os.remove(f"data/{dataset['file']}")
                    os.rename(f"data/{expected}", f"data/{dataset['file']}")
                    renamed = True
                
                if not renamed:
                    for file in os.listdir('data/'):
                        if file.endswith('.csv') and file != dataset['file']:
                            # If we have an expected name, only take it. Otherwise take any.
                            if not expected or file.lower() == expected.lower():
                                if os.path.exists(f"data/{dataset['file']}"):
                                    os.remove(f"data/{dataset['file']}")
                                try:
                                    os.rename(f"data/{file}", f"data/{dataset['file']}")
                                    renamed = True
                                    break
                                except:
                                    pass
                
                return {
                    'status': 'success',
                    'message': f'Downloaded {dataset["name"]} successfully',
                    'file': f"data/{dataset['file']}"
                }
            else:
                return {'status': 'error', 'message': 'Download failed'}
            
        except Exception as e:
            return {'status': 'error', 'message': str(e)}
    
    def load_kaggle_dataset(self, dataset_key):
        """Load Kaggle dataset into analytics engine"""
        if dataset_key not in self.datasets:
            return None
        
        dataset = self.datasets[dataset_key]
        file_path = f"data/{dataset['file']}"
        
        # Check if file exists, if not try to download
        if not os.path.exists(file_path):
            result = self.download_dataset(dataset_key)
            if result['status'] != 'success':
                return None
        
        try:
            df = pd.read_csv(file_path)
            df = self._convert_to_standard_format(df, dataset_key)
            return df
        except Exception as e:
            print(f"Error loading dataset: {e}")
            return None
    
    def _convert_to_standard_format(self, df, dataset_key):
        """Convert Kaggle dataset to our standard format"""
        try:
            if dataset_key == 'supermarket_sales':
                # Supermarket Sales dataset
                df = df.rename(columns={
                    'Product line': 'Category',
                    'Unit price': 'Price',
                    'Quantity': 'Quantity',
                    'Total': 'Total_Sales',
                    'Date': 'Date',
                    'Payment': 'Payment_Method',
                    'Gender': 'Gender',
                    'Customer type': 'Customer_Type'
                })
                if 'Product' not in df.columns:
                    df['Product'] = df['Category'] + ' - ' + df.index.astype(str)
                
                # Convert date
                df['Date'] = pd.to_datetime(df['Date'], errors='coerce')
                
            elif dataset_key == 'walmart_sales':
                # Walmart Sales dataset
                df['Date'] = pd.to_datetime(df['Date'], dayfirst=True, errors='coerce')
                df['Product'] = 'Walmart Store ' + df['Store'].astype(str)
                df['Category'] = 'Store Sales'
                df['Price'] = df['Weekly_Sales'] / 100
                df['Quantity'] = 100
                df['Total_Sales'] = df['Weekly_Sales']
                
            elif dataset_key == 'bigmart_sales':
                # BigMart Sales dataset
                df['Product'] = df['Item_Identifier']
                df['Category'] = df['Item_Type']
                df['Price'] = df['Item_MRP']
                df['Quantity'] = 1
                df['Total_Sales'] = df['Item_Outlet_Sales']
                df['Date'] = pd.date_range(end=datetime.now(), periods=len(df), freq='D')
            
            # Clean data
            df['Total_Sales'] = pd.to_numeric(df['Total_Sales'], errors='coerce').fillna(0)
            df['Quantity'] = pd.to_numeric(df['Quantity'], errors='coerce').fillna(1)
            df['Price'] = pd.to_numeric(df['Price'], errors='coerce').fillna(0)
            
            # Convert to Indian Rupees (multiply by approximate conversion rate if needed)
            # For Walmart data (USD to INR: ~83)
            if dataset_key == 'walmart_sales':
                df['Total_Sales'] = df['Total_Sales'] * 83
                df['Price'] = df['Price'] * 83
            
            return df
            
        except Exception as e:
            print(f"Conversion error: {e}")
            return df

kaggle_manager = KaggleDatasetManager()

# ============================================================================
# SETTINGS MANAGER
# ============================================================================

class SettingsManager:
    def __init__(self):
        self.settings_file = 'settings.json'
        self.default_settings = {
            'theme': 'light',
            'chatbot_voice': True,
            'auto_refresh': False,
            'currency': 'INR',
            'chart_colors': ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
        }
        self.settings = self.load_settings()
    
    def load_settings(self):
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r') as f:
                    return json.load(f)
        except:
            pass
        return self.default_settings.copy()
    
    def save_settings(self):
        with open(self.settings_file, 'w') as f:
            json.dump(self.settings, f, indent=2)
    
    def get(self, key):
        return self.settings.get(key, self.default_settings.get(key))
    
    def set(self, key, value):
        self.settings[key] = value
        self.save_settings()
        return True

settings_manager = SettingsManager()

# ============================================================================
# ANALYTICS ENGINE
# ============================================================================

class SuperMarketAnalytics:
    def __init__(self):
        self.data = None
        self.model = None
        self.scaler = None
        self.file_name = None
        
    def load_data(self, file):
        try:
            self.file_name = file.filename
            if file.filename.endswith('.csv'):
                self.data = pd.read_csv(file)
            elif file.filename.endswith(('.xlsx', '.xls')):
                self.data = pd.read_excel(file)
            else:
                return None
            
            self._preprocess_data()
            return self.data
        except Exception as e:
            print(f"Error: {e}")
            return None
    
    def _preprocess_data(self):
        # Date handling
        date_cols = ['Date', 'date', 'DATE', 'TransactionDate', 'OrderDate']
        for col in date_cols:
            if col in self.data.columns:
                self.data['Date'] = pd.to_datetime(self.data[col], dayfirst=True, errors='coerce')
                break
        
        if 'Date' not in self.data.columns:
            self.data['Date'] = pd.date_range(end=datetime.now(), periods=len(self.data), freq='D')
        
        # Drop rows where Date is NaT
        self.data = self.data.dropna(subset=['Date'])
        
        # Time features
        self.data['Month'] = self.data['Date'].dt.month
        self.data['Month_Name'] = self.data['Date'].dt.strftime('%B')
        self.data['Day'] = self.data['Date'].dt.day
        self.data['Weekday'] = self.data['Date'].dt.dayofweek
        self.data['Weekday_Name'] = self.data['Date'].dt.strftime('%A')
        self.data['IsWeekend'] = (self.data['Weekday'] >= 5).astype(int)
        
        # Cyclical encoding
        self.data['Month_Sin'] = np.sin(2 * np.pi * self.data['Month'] / 12)
        self.data['Month_Cos'] = np.cos(2 * np.pi * self.data['Month'] / 12)
        self.data['Weekday_Sin'] = np.sin(2 * np.pi * self.data['Weekday'] / 7)
        self.data['Weekday_Cos'] = np.cos(2 * np.pi * self.data['Weekday'] / 7)
        
        # Calculate total sales
        if 'Total_Sales' not in self.data.columns:
            if 'Quantity' in self.data.columns and 'Price' in self.data.columns:
                self.data['Total_Sales'] = self.data['Quantity'] * self.data['Price']
            elif 'Sales' in self.data.columns:
                self.data['Total_Sales'] = self.data['Sales']
            else:
                self.data['Total_Sales'] = np.random.uniform(100, 5000, len(self.data))
        
        # Clean numeric columns
        self.data['Total_Sales'] = pd.to_numeric(self.data['Total_Sales'], errors='coerce').fillna(0)
        
        # Rolling averages
        if 'Date' in self.data.columns:
            df_sorted = self.data.sort_values('Date')
            df_sorted['Sales_MA7'] = df_sorted['Total_Sales'].rolling(window=7, min_periods=1).mean()
            df_sorted['Sales_MA30'] = df_sorted['Total_Sales'].rolling(window=30, min_periods=1).mean()
            self.data = df_sorted
        
        return self.data
    
    def get_metrics(self):
        metrics = {
            'total_sales': 0,
            'total_sales_formatted': '₹0',
            'avg_daily_sales': 0,
            'avg_daily_formatted': '₹0',
            'total_transactions': 0,
            'unique_products': 0,
            'unique_categories': 0,
            'best_product': 'N/A',
            'best_category': 'N/A',
            'avg_transaction': 0,
            'avg_transaction_formatted': '₹0',
            'growth_rate': 0,
            'weekend_ratio': 0,
            'file_name': self.file_name or 'No file uploaded'
        }
        
        if self.data is None:
            return metrics
        
        if 'Total_Sales' in self.data.columns:
            metrics['total_sales'] = float(self.data['Total_Sales'].sum())
            metrics['total_sales_formatted'] = format_indian_rupee(metrics['total_sales'])
            metrics['avg_transaction'] = float(self.data['Total_Sales'].mean())
            metrics['avg_transaction_formatted'] = format_indian_rupee(metrics['avg_transaction'])
            metrics['total_transactions'] = len(self.data)
            
            if 'Date' in self.data.columns:
                daily = self.data.groupby('Date')['Total_Sales'].sum()
                metrics['avg_daily_sales'] = float(daily.mean())
                metrics['avg_daily_formatted'] = format_indian_rupee(metrics['avg_daily_sales'])
        
        if 'Product' in self.data.columns:
            metrics['unique_products'] = self.data['Product'].nunique()
            product_sales = self.data.groupby('Product')['Total_Sales'].sum()
            if len(product_sales) > 0:
                metrics['best_product'] = product_sales.idxmax()
        
        if 'Category' in self.data.columns:
            metrics['unique_categories'] = self.data['Category'].nunique()
            cat_sales = self.data.groupby('Category')['Total_Sales'].sum()
            if len(cat_sales) > 0:
                metrics['best_category'] = cat_sales.idxmax()
        
        if 'Date' in self.data.columns and len(self.data) > 60:
            recent = self.data[self.data['Date'] >= self.data['Date'].max() - timedelta(days=30)]['Total_Sales'].sum()
            previous = self.data[self.data['Date'] < self.data['Date'].max() - timedelta(days=30)]['Total_Sales'].sum()
            metrics['growth_rate'] = ((recent - previous) / previous * 100) if previous > 0 else 0
        
        if 'IsWeekend' in self.data.columns and 'Total_Sales' in self.data.columns:
            weekend = self.data[self.data['IsWeekend'] == 1]['Total_Sales'].sum()
            weekday = self.data[self.data['IsWeekend'] == 0]['Total_Sales'].sum()
            metrics['weekend_ratio'] = (weekend / weekday) if weekday > 0 else 0
        
        return metrics
    
    def get_top_products(self, n=10):
        if self.data is None or 'Product' not in self.data.columns:
            return []
        product_stats = self.data.groupby('Product')['Total_Sales'].agg(['sum', 'mean', 'count']).round(2)
        product_stats.columns = ['total_sales', 'avg_sales', 'transactions']
        product_stats = product_stats.sort_values('total_sales', ascending=False).head(n)
        product_stats = product_stats.reset_index()
        
        # Add formatted sales
        product_stats['total_sales_formatted'] = product_stats['total_sales'].apply(format_indian_rupee)
        product_stats['avg_sales_formatted'] = product_stats['avg_sales'].apply(format_indian_rupee)
        
        return product_stats.to_dict('records')
    
    def get_category_sales(self):
        if self.data is None or 'Category' not in self.data.columns:
            return []
        cat_stats = self.data.groupby('Category')['Total_Sales'].agg(['sum', 'mean', 'count']).round(2)
        cat_stats.columns = ['total_sales', 'avg_sales', 'transactions']
        cat_stats = cat_stats.sort_values('total_sales', ascending=False)
        cat_stats = cat_stats.reset_index()
        
        # Add formatted sales
        cat_stats['total_sales_formatted'] = cat_stats['total_sales'].apply(format_indian_rupee)
        
        return cat_stats.to_dict('records')
    
    def get_time_series(self):
        if self.data is None or 'Date' not in self.data.columns:
            return []
        daily = self.data.groupby('Date')['Total_Sales'].agg(['sum', 'mean', 'count']).reset_index()
        daily.columns = ['date', 'total_sales', 'avg_sales', 'transactions']
        daily['total_sales_formatted'] = daily['total_sales'].apply(format_indian_rupee)
        return daily.to_dict('records')
    
    def segment_products(self):
        if self.data is None or 'Product' not in self.data.columns:
            return {'high_sales': [], 'low_sales': []}
        product_sales = self.data.groupby('Product')['Total_Sales'].sum()
        median = product_sales.median()
        high = product_sales[product_sales > median].nlargest(10).to_dict()
        low = product_sales[product_sales <= median].nsmallest(10).to_dict()
        return {
            'high_sales': [{'product': k, 'sales': v, 'sales_formatted': format_indian_rupee(v)} for k, v in high.items()],
            'low_sales': [{'product': k, 'sales': v, 'sales_formatted': format_indian_rupee(v)} for k, v in low.items()]
        }
    
    def train_model(self):
        if self.data is None or len(self.data) < 50:
            return {'status': 'error', 'message': 'Need at least 50 records'}
        
        feature_cols = ['Month_Sin', 'Month_Cos', 'Weekday_Sin', 'Weekday_Cos', 'IsWeekend']
        if 'Sales_MA7' in self.data.columns:
            feature_cols.append('Sales_MA7')
        
        df_clean = self.data[feature_cols + ['Total_Sales']].dropna()
        if len(df_clean) < 50:
            return {'status': 'error', 'message': 'Insufficient clean data'}
        
        X = df_clean[feature_cols].values
        y = df_clean['Total_Sales'].values
        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)
        self.model = RandomForestRegressor(n_estimators=100, random_state=42)
        self.model.fit(X_scaled, y)
        
        predictions = self.model.predict(X_scaled)
        r2 = r2_score(y, predictions)
        return {'status': 'success', 'r2_score': r2, 'message': f'Model trained with R² score: {r2:.2f}'}
    
    def predict_future(self, days=30):
        if self.model is None:
            return self._simple_forecast(days)
        
        try:
            predictions = []
            last_date = self.data['Date'].max() if 'Date' in self.data.columns else datetime.now()
            last_row = self.data.sort_values('Date').iloc[-1]
            
            for i in range(1, days + 1):
                future_date = last_date + timedelta(days=i)
                features = np.array([
                    np.sin(2 * np.pi * future_date.month / 12),
                    np.cos(2 * np.pi * future_date.month / 12),
                    np.sin(2 * np.pi * future_date.weekday() / 7),
                    np.cos(2 * np.pi * future_date.weekday() / 7),
                    1 if future_date.weekday() >= 5 else 0,
                    last_row.get('Sales_MA7', last_row.get('Total_Sales', 100))
                ]).reshape(1, -1)
                
                features_scaled = self.scaler.transform(features)
                pred = self.model.predict(features_scaled)[0]
                
                if future_date.month in [11, 12]:
                    pred *= 1.3
                elif future_date.month in [6, 7, 8]:
                    pred *= 1.1
                
                predictions.append({
                    'date': future_date.strftime('%Y-%m-%d'),
                    'predicted_sales': round(max(0, pred), 2),
                    'predicted_sales_formatted': format_indian_rupee(max(0, pred))
                })
            return predictions
        except:
            return self._simple_forecast(days)
    
    def _simple_forecast(self, days):
        if self.data is None:
            return []
        avg = self.data['Total_Sales'].mean()
        last_date = self.data['Date'].max() if 'Date' in self.data.columns else datetime.now()
        predictions = []
        for i in range(1, days + 1):
            future_date = last_date + timedelta(days=i)
            factor = 1.3 if future_date.month in [11, 12] else 1.0
            pred = avg * factor
            predictions.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_sales': round(pred, 2),
                'predicted_sales_formatted': format_indian_rupee(pred)
            })
        return predictions

analytics = SuperMarketAnalytics()

# ============================================================================
# VISUALIZATIONS
# ============================================================================

def create_visualizations(data):
    visualizations = {}
    colors = settings_manager.get('chart_colors')
    
    # Sales Trend Chart
    if 'Date' in data.columns and 'Total_Sales' in data.columns:
        daily = data.groupby('Date')['Total_Sales'].sum().reset_index()
        
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=daily['Date'], 
            y=daily['Total_Sales'],
            mode='lines+markers', 
            name='Daily Sales',
            line=dict(color=colors[0], width=3),
            marker=dict(size=6, color=colors[0]),
            fill='tozeroy',
            fillcolor=f'rgba({int(colors[0][1:3],16)},{int(colors[0][3:5],16)},{int(colors[0][5:7],16)},0.2)',
            hovertemplate='Date: %{x}<br>Sales: ₹%{y:,.2f}<extra></extra>'
        ))
        
        # Add 7-day moving average
        if len(daily) > 7:
            ma7 = daily['Total_Sales'].rolling(window=7).mean()
            fig.add_trace(go.Scatter(
                x=daily['Date'], 
                y=ma7,
                mode='lines', 
                name='7-Day Average',
                line=dict(color=colors[1], width=2, dash='dash'),
                hovertemplate='Date: %{x}<br>7-Day Avg: ₹%{y:,.2f}<extra></extra>'
            ))
        
        fig.update_layout(
            title='Sales Trend (Indian Rupees)',
            xaxis_title='Date',
            yaxis_title='Sales (₹)',
            template='plotly_white',
            height=500,
            hovermode='x unified',
            yaxis=dict(tickprefix='₹', tickformat=',.0f')
        )
        visualizations['sales_trend'] = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
    
    # Top Products Bar Chart
    if 'Product' in data.columns and 'Total_Sales' in data.columns:
        product_sales = data.groupby('Product')['Total_Sales'].sum().nlargest(10).sort_values()
        
        fig = go.Figure(go.Bar(
            x=product_sales.values, 
            y=product_sales.index, 
            orientation='h',
            marker_color=colors[1],
            text=[f'₹{v:,.0f}' for v in product_sales.values],
            textposition='outside',
            hovertemplate='Product: %{y}<br>Sales: ₹%{x:,.2f}<extra></extra>'
        ))
        fig.update_layout(
            title='Top 10 Products',
            xaxis_title='Sales (₹)',
            yaxis_title='Product',
            template='plotly_white',
            height=500,
            xaxis=dict(tickprefix='₹', tickformat=',.0f')
        )
        visualizations['product_sales'] = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
    
    # Category Pie Chart
    if 'Category' in data.columns and 'Total_Sales' in data.columns:
        cat_sales = data.groupby('Category')['Total_Sales'].sum()
        
        fig = go.Figure(go.Pie(
            labels=cat_sales.index, 
            values=cat_sales.values, 
            hole=0.3,
            marker=dict(colors=colors[:len(cat_sales)]),
            textinfo='label+percent',
            hovertemplate='Category: %{label}<br>Sales: ₹%{value:,.2f}<br>Percentage: %{percent}<extra></extra>'
        ))
        fig.update_layout(
            title='Sales by Category',
            template='plotly_white',
            height=450
        )
        visualizations['category_sales'] = json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
    
    return visualizations

# ============================================================================
# AI CHATBOT
# ============================================================================

class AIChatbot:
    def __init__(self):
        self.name = "SalesBot"
        self.greet_count = 0

    def get_response(self, message, metrics):
        msg = message.lower().strip()

        # ── Greetings ──────────────────────────────────────────────────
        if any(w in msg for w in ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'howdy']):
            self.greet_count += 1
            if self.greet_count == 1:
                return "👋 **Hey there! I'm SalesBot**, your AI sales companion!\n\nI can help you dig into your sales data, spot trends, and answer questions about your business. Here's what I can do:\n\n📊 **Analyze** revenue, products & categories\n📈 **Forecast** future sales trends\n💡 **Recommend** what to promote or restock\n🗣️ Just chat naturally — no commands needed!\n\nWhat would you like to explore today?"
            else:
                return "👋 Hey again! Still here and ready to help. What's on your mind?"

        # ── Identity / About ────────────────────────────────────────────
        if any(w in msg for w in ['who are you', 'what are you', 'about you', 'your name']):
            return "🤖 I'm **SalesBot** — an AI assistant built into the Super Market Sales G platform.\n\nI'm trained to help you understand your sales data, answer business questions, forecast trends, and give actionable recommendations.\n\nI'm not just a search engine — ask me anything! 😊"

        # ── How are you / wellbeing ─────────────────────────────────────
        if any(w in msg for w in ['how are you', 'how r u', 'how do you do', "you okay", "you good"]):
            return "😄 I'm doing great, thanks for asking! Always running at full capacity and ready to crunch some numbers.\n\nMore importantly — how can I help **you** today? 📊"

        # ── Thanks / appreciation ───────────────────────────────────────
        if any(w in msg for w in ['thank', 'thanks', 'thank you', 'thx', 'ty', 'great', 'awesome', 'nice', 'perfect', 'excellent']):
            return "😊 You're very welcome! Happy to help anytime.\n\nAnything else you'd like to explore? I'm always here! 🚀"

        # ── Goodbye ─────────────────────────────────────────────────────
        if any(w in msg for w in ['bye', 'goodbye', 'see you', 'cya', 'later', 'quit', 'exit']):
            return "👋 Goodbye! Come back anytime — your data will be waiting! 📊✨"

        # ── Help ────────────────────────────────────────────────────────
        if any(w in msg for w in ['help', 'what can you do', 'commands', 'options', 'features']):
            return """🤖 **Here's everything I can help with:**

📦 **Products & Sales**
• "What's my best selling product?"
• "Show me top 10 products"
• "Which products are underperforming?"

💰 **Revenue & Metrics**
• "What's my total revenue?"
• "Show me daily average sales"
• "What's my growth rate?"

📁 **Categories**
• "Which category performs best?"
• "Break down sales by category"

📈 **Forecasting**
• "Predict next month's sales"
• "What's my sales forecast?"

💡 **Recommendations**
• "What should I promote?"
• "Give me business tips"

Just type naturally — I'll understand! 😊"""

        # ── No data loaded ──────────────────────────────────────────────
        has_data = metrics.get('total_sales', 0) > 0

        if not has_data and any(w in msg for w in ['sales', 'revenue', 'product', 'category', 'forecast', 'predict', 'best', 'top', 'worst', 'data', 'analytics']):
            return "📂 **No data loaded yet!**\n\nTo get started, go to the **Dashboard** and either:\n1. 📤 Upload your own CSV or Excel file\n2. 🗃️ Click one of the Kaggle datasets (Supermarket, Walmart, or BigMart)\n\nOnce loaded, I'll give you a full breakdown of your sales insights! 🚀"

        # ── Best / Top products ─────────────────────────────────────────
        if any(w in msg for w in ['best', 'top', 'popular', 'highest', 'most sold', 'best seller', 'bestseller']):
            best = metrics.get('best_product', 'N/A')
            total = metrics.get('total_sales_formatted', '₹0')
            products = metrics.get('unique_products', 0)
            best_cat = metrics.get('best_category', 'N/A')
            if best != 'N/A':
                return f"🏆 **Top Performing Product**\n\n**{best}** is your #1 product right now!\n\n📊 Store-wide stats:\n• Total Revenue: **{total}**\n• Total Products Tracked: **{products}**\n• Leading Category: **{best_cat}**\n\n💡 *Tip: Consider increasing stock and promotions for {best} to maximize revenue!*\n\n👉 Want me to show you the full top-10 list or category breakdown?"
            return "📊 Load your sales data first and I'll identify your star products instantly!"

        # ── Worst / Low performing ──────────────────────────────────────
        if any(w in msg for w in ['worst', 'low', 'underperform', 'slow', 'least']):
            return f"📉 **Low Performing Products**\n\nAfter loading your data, head to the **Products** section in the sidebar to see the segmentation analysis which highlights:\n• 🔴 Low-sales products needing attention\n• 🟢 High-sales winners to double down on\n\n💡 *Tip: For slow-moving products, consider discounts, bundling, or discontinuing them.*"

        # ── Total / Revenue / Sales ─────────────────────────────────────
        if any(w in msg for w in ['total', 'revenue', 'income', 'earning', 'money', 'how much', 'sales figure']):
            total = metrics.get('total_sales_formatted', '₹0')
            transactions = metrics.get('total_transactions', 0)
            avg = metrics.get('avg_transaction_formatted', '₹0')
            avg_daily = metrics.get('avg_daily_formatted', '₹0')
            growth = metrics.get('growth_rate', 0)
            growth_icon = "📈" if growth >= 0 else "📉"
            return f"💰 **Full Revenue Breakdown**\n\n• 🏷️ Total Revenue: **{total}**\n• 🛒 Total Transactions: **{transactions:,}**\n• 💵 Avg Transaction Value: **{avg}**\n• 📅 Avg Daily Sales: **{avg_daily}**\n• {growth_icon} Growth Rate: **{growth:+.1f}%**\n\n{'📈 Great work — positive growth trend!' if growth > 0 else '⚠️ Negative growth. Consider promotions or stock review.'}\n\n👉 Want a full 30-day sales forecast?"

        # ── Category ────────────────────────────────────────────────────
        if any(w in msg for w in ['category', 'categories', 'department', 'section', 'product line', 'type']):
            best_cat = metrics.get('best_category', 'N/A')
            num_cats = metrics.get('unique_categories', 0)
            total = metrics.get('total_sales_formatted', '₹0')
            if best_cat != 'N/A':
                return f"📁 **Category Performance**\n\n• 🏆 Top Category: **{best_cat}**\n• 📋 Total Categories: **{num_cats}**\n• 💰 Total Revenue Across All: **{total}**\n\n💡 *Focus your marketing on {best_cat} — it's your highest-grossing segment!*\n\n👉 Check the Category pie chart on your Dashboard for a full visual breakdown."
            return "📁 Load your data and I'll break down performance by category, including which areas are driving the most revenue!"

        # ── Predict / Forecast ──────────────────────────────────────────
        if any(w in msg for w in ['predict', 'forecast', 'future', 'next month', 'upcoming', 'projection', 'trend']):
            growth = metrics.get('growth_rate', 0)
            weekend_ratio = metrics.get('weekend_ratio', 0)
            return f"📈 **Sales Forecast Insights**\n\n• 📅 Current Growth Rate: **{growth:+.1f}%**\n• 🛍️ Weekend vs Weekday Sales: **{weekend_ratio*100:.0f}% higher on weekends**\n• 🗓️ Peak Season: November–December (holiday boost)\n• ☀️ Summer (Jun–Aug): typically +10% uplift\n\n**AI Model Prediction (30 days):**\nAvailable in the **Predictions** sidebar — shows daily forecast powered by our Random Forest model!\n\n💡 *Tip: Stock up before November for maximum holiday season sales.*\n\n👉 Click **Predictions** in the sidebar to see the full forecast chart."

        # ── Recommend / Tips / Advice ───────────────────────────────────
        if any(w in msg for w in ['recommend', 'suggest', 'advice', 'tip', 'improve', 'strategy', 'what should', 'how to']):
            best = metrics.get('best_product', 'your top product')
            best_cat = metrics.get('best_category', 'your top category')
            growth = metrics.get('growth_rate', 0)
            tips = []
            tips.append(f"🔥 Double down on **{best}** — promote it heavily")
            tips.append(f"📁 **{best_cat}** is your top category — expand your range here")
            if growth < 0:
                tips.append("⚠️ Growth is negative — try discounts or bundle offers")
            else:
                tips.append("✅ Growth is positive — maintain momentum with loyalty programs")
            tips.append("🛍️ Weekend sales spike — run weekend-specific deals")
            tips.append("📧 Use email marketing before peak November–December season")
            tips_text = "\n".join(f"• {t}" for t in tips)
            return f"💡 **Business Recommendations**\n\n{tips_text}\n\n👉 Check **Analytics** and **Predictions** for more detailed insights!"

        # ── Growth ──────────────────────────────────────────────────────
        if any(w in msg for w in ['growth', 'trend', 'increasing', 'decreasing', 'up', 'down', 'change']):
            growth = metrics.get('growth_rate', 0)
            status = "positive 📈" if growth >= 0 else "negative 📉"
            return f"📊 **Growth Analysis**\n\nYour current growth rate is **{growth:+.1f}%** ({status}).\n\n{'🎉 Keep it up! Your recent performance is outpacing the previous period.' if growth > 0 else '⚠️ Sales have dipped. Consider running promotions or checking inventory.'}\n\n👉 Use the **Predictions** section for a 30-day data-driven forecast."

        # ── Average / Daily ─────────────────────────────────────────────
        if any(w in msg for w in ['average', 'daily', 'per day', 'mean', 'typical']):
            avg_daily = metrics.get('avg_daily_formatted', '₹0')
            avg_txn = metrics.get('avg_transaction_formatted', '₹0')
            return f"📅 **Average Sales Metrics**\n\n• 📆 Daily Average Sales: **{avg_daily}**\n• 🛒 Avg Transaction Value: **{avg_txn}**\n\n💡 *Increasing average transaction value by even 10% has a compounding effect on total revenue!*"

        # ── Fallback ─────────────────────────────────────────────────────
        return f"🤔 Hmm, I'm not quite sure what you mean by *\"{message}\"*.\n\nHere are things I can help with:\n• 📊 Sales totals & revenue\n• 🏆 Best selling products\n• 📁 Category breakdown\n• 📈 Forecasts & trends\n• 💡 Business recommendations\n\nJust ask naturally — like **\"what are my top products?\"** or **\"show me revenue\"**. I'll figure it out! 😊"

chatbot = AIChatbot()

def speak_text(text):
    try:
        if settings_manager.get('chatbot_voice'):
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
    except:
        pass

# ============================================================================
# ROUTES
# ============================================================================

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/settings')
@login_required
def settings_page():
    return render_template('settings.html')

@app.route('/health')
def health_check():
    return jsonify({'status': 'ok', 'message': 'Super Market Sales G is running'})

@app.route('/status')
def status():
    uptime = datetime.now() - START_TIME
    return jsonify({'status': 'ok', 'app': 'Super Market Sales G', 'uptime': str(uptime).split('.')[0], 'started_at': START_TIME.isoformat()})

@app.route('/api/settings', methods=['GET', 'POST'])
def handle_settings():
    if request.method == 'GET':
        return jsonify(settings_manager.settings)
    elif request.method == 'POST':
        data = request.json
        for key, value in data.items():
            settings_manager.set(key, value)
        return jsonify({'status': 'success', 'settings': settings_manager.settings})

@app.route('/google-login', methods=['POST'])
def google_login():
    try:
        data = request.json
        token = data.get('credential')
        client_id = os.getenv('GOOGLE_CLIENT_ID')
        
        # If no token (Mock mode from frontend) or missing client_id
        if not token or not client_id:
            print("Google Login: Using Mock fallback (No token or Client ID)")
            session['user'] = {
                'name': 'SalesG Admin', 
                'email': 'admin@salesg.ai', 
                'picture': 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png'
            }
            return jsonify({'status': 'success', 'user': session['user'], 'is_mock': True})

        try:
            # Real Token Verification
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), client_id)
            
            session['user'] = {
                'name': idinfo.get('name', 'Google User'),
                'email': idinfo.get('email'),
                'picture': idinfo.get('picture')
            }
            return jsonify({'status': 'success', 'user': session['user']})
            
        except Exception as ve:
            # Catch all verification errors (ValueError, but also others like network timeout)
            print(f"Google Token Verification Failed: {str(ve)}")
            # Reverting to Mock for development ease
            session['user'] = {
                'name': 'SalesG Developer', 
                'email': 'dev@salesg.ai', 
                'picture': 'https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png'
            }
            return jsonify({
                'status': 'success', 
                'user': session['user'], 
                'is_mock': True, 
                'warning': f'Verification failed: {str(ve)}. Reverted to Mock for development.'
            })
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'status': 'error', 'message': f'Internal Server Error: {str(e)}'}), 500

@app.route('/guest-login', methods=['POST'])
def guest_login():
    session['user'] = {'name': 'Guest User', 'email': 'guest@example.com', 'picture': 'https://via.placeholder.com/40'}
    return jsonify({'status': 'success', 'user': session['user']})

@app.route('/manual-login', methods=['POST'])
def manual_login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Simple manual login for local development
    if username == 'admin' and password == 'admin':
        session['user'] = {'name': 'Admin User', 'email': 'admin@example.com', 'picture': 'https://via.placeholder.com/40'}
        return jsonify({'status': 'success', 'user': session['user']})
    else:
        return jsonify({'status': 'error', 'message': 'Invalid username or password'}), 401

@app.route('/logout')
def logout():
    session.clear()
    return redirect('/')

@app.route('/upload', methods=['POST'])
@login_required
def upload_file():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        data = analytics.load_data(file)
        if data is None:
            return jsonify({'error': 'Invalid file format. Please upload CSV or Excel file.'}), 400
        
        train_result = analytics.train_model()
        metrics = analytics.get_metrics()
        top_products = analytics.get_top_products(10)
        category_analysis = analytics.get_category_sales()
        time_series = analytics.get_time_series()
        predictions = analytics.predict_future(30)
        segments = analytics.segment_products()
        visualizations = create_visualizations(data)
        
        return jsonify({
            'status': 'success',
            'metrics': metrics,
            'top_products': top_products,
            'category_analysis': category_analysis,
            'time_series': time_series,
            'predictions': predictions,
            'segments': segments,
            'visualizations': visualizations,
            'train_result': train_result,
            'data_preview': data.head(10).to_dict('records')
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    try:
        message = request.json.get('message', '')
        context = analytics.get_metrics()
        response = chatbot.get_response(message, context)
        return jsonify({'response': response, 'speak': response})
    except Exception as e:
        return jsonify({'response': str(e), 'speak': 'Error'}), 500

@app.route('/speak', methods=['POST'])
@login_required
def speak():
    try:
        text = request.json.get('text', '')
        speak_text(text)
        return jsonify({'status': 'success'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-report', methods=['POST'])
@login_required
def generate_report():
    try:
        data = request.json
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        story = []
        
        title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=24, textColor=colors.HexColor('#667eea'), spaceAfter=30)
        story.append(Paragraph("Super Market Sales G - Report", title_style))
        story.append(Spacer(1, 12))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 20))
        
        if data.get('metrics'):
            story.append(Paragraph("Executive Summary", styles['Heading2']))
            metrics = data['metrics']
            metrics_data = [
                ["Metric", "Value"],
                ["Total Sales", metrics.get('total_sales_formatted', '₹0')],
                ["Best Product", metrics.get('best_product', 'N/A')],
                ["Best Category", metrics.get('best_category', 'N/A')],
                ["Total Transactions", f"{metrics.get('total_transactions', 0):,}"],
                ["Growth Rate", f"{metrics.get('growth_rate', 0):+.1f}%"]
            ]
            table = Table(metrics_data, colWidths=[2.5*inch, 3.5*inch])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(table)
        
        doc.build(story)
        buffer.seek(0)
        
        return send_file(buffer, as_attachment=True, download_name=f'sales_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf', mimetype='application/pdf')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sample-data')
def sample_data():
    try:
        products = ['Milk', 'Bread', 'Eggs', 'Cheese', 'Yogurt', 'Apples', 'Bananas', 'Chicken', 'Rice', 'Pasta']
        categories = ['Dairy', 'Bakery', 'Dairy', 'Dairy', 'Dairy', 'Fruits', 'Fruits', 'Meat', 'Grains', 'Grains']
        
        dates = pd.date_range(start='2024-01-01', end='2024-03-31', freq='D')
        data = []
        
        for date in dates:
            for _ in range(np.random.randint(20, 50)):
                idx = np.random.randint(0, len(products))
                quantity = np.random.randint(1, 5)
                price = np.random.uniform(50, 500)  # Indian Rupees
                data.append({
                    'Date': date,
                    'Product': products[idx],
                    'Category': categories[idx],
                    'Quantity': quantity,
                    'Price': round(price, 2),
                    'Total_Sales': round(quantity * price, 2)
                })
        
        df = pd.DataFrame(data)
        buffer = io.BytesIO()
        df.to_csv(buffer, index=False)
        buffer.seek(0)
        
        return send_file(buffer, as_attachment=True, download_name='sample_sales_data.csv', mimetype='text/csv')
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/datasets', methods=['GET'])
def list_datasets():
    datasets = []
    for key, info in kaggle_manager.datasets.items():
        datasets.append({
            'key': key,
            'name': info['name'],
            'description': info['description']
        })
    return jsonify({'datasets': datasets})

@app.route('/api/datasets/load/<dataset_key>', methods=['POST'])
@login_required
def load_kaggle_dataset(dataset_key):
    try:
        # Check if file exists in data/
        dataset = kaggle_manager.datasets.get(dataset_key)
        if not dataset:
            return jsonify({'error': 'Dataset configuration not found'}), 400
            
        file_path = f"data/{dataset['file']}"
        
        if not os.path.exists(file_path):
            result = kaggle_manager.download_dataset(dataset_key)
            if result['status'] != 'success':
                return jsonify({'error': result['message']}), 400
        
        df = kaggle_manager.load_kaggle_dataset(dataset_key)
        if df is None:
            return jsonify({'error': 'Failed to load dataset file even after download.'}), 400
        
        # Load into analytics engine
        analytics.data = df
        analytics._preprocess_data()
        
        # Train model
        train_result = analytics.train_model()
        
        # Get metrics
        response_data = {
            'status': 'success',
            'metrics': analytics.get_metrics(),
            'top_products': analytics.get_top_products(10),
            'category_analysis': analytics.get_category_sales(),
            'time_series': analytics.get_time_series(),
            'predictions': analytics.predict_future(30),
            'segments': analytics.segment_products(),
            'visualizations': create_visualizations(df),
            'train_result': train_result,
            'dataset_name': kaggle_manager.datasets[dataset_key]['name']
        }

        # Safe serialization for data_preview
        preview_df = df.head(10).copy()
        for col in preview_df.columns:
            if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d')
            else:
                preview_df[col] = preview_df[col].apply(lambda x: str(x) if pd.api.types.is_number(x) and (np.isnan(x) or np.isinf(x)) else x)
        
        response_data['data_preview'] = preview_df.to_dict('records')
        
        return jsonify(response_data)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e), 'status': 'error'}), 500

if __name__ == '__main__':
    print("\n" + "="*60)
    print("🛒 SUPER MARKET SALES G - INDIAN EDITION")
    print("="*60)
    print("📍 Server: http://localhost:5000")
    print("💰 Currency: Indian Rupees (₹)")
    print("📊 Kaggle Datasets: Supermarket Sales, Walmart, BigMart")
    print("="*60 + "\n")
    app.run(debug=True, host='0.0.0.0', port=5000)