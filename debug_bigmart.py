import pandas as pd
from datetime import datetime
import numpy as np
from app import SuperMarketAnalytics, KaggleDatasetManager

def debug_bigmart():
    print("Initializing Kaggle Manager...")
    km = KaggleDatasetManager()
    
    print("Loading BigMart dataset...")
    df = km.load_kaggle_dataset('bigmart_sales')
    if df is None:
        print("Failed to load BigMart via KaggleManager!")
        return

    print(f"Loaded DF. Columns: {df.columns.tolist()}")
    print(f"Shape: {df.shape}")
    
    print("Initializing Analytics Engine...")
    analytics = SuperMarketAnalytics()
    analytics.data = df
    
    print("Preprocessing data...")
    analytics._preprocess_data()
    
    print("Training model...")
    res = analytics.train_model()
    print(f"Train Result: {res}")
    
    print("Calculating metrics...")
    metrics = analytics.get_metrics()
    print("Metrics calculated.")
    
    print("Creating visualizations...")
    from app import create_visualizations
    viz = create_visualizations(analytics.data)
    print("Visualizations created.")
    
    print("Predicting future...")
    future = analytics.predict_future()
    print("Predictions created.")

if __name__ == "__main__":
    try:
        debug_bigmart()
        print("SUCCESS! No crash in backend logic.")
    except Exception as e:
        import traceback
        traceback.print_exc()

