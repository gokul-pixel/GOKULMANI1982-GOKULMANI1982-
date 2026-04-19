import os
from kaggle.api.kaggle_api_extended import KaggleApi


def main():
    try:
        api = KaggleApi()
        api.authenticate()
        print('✅ Kaggle API authenticated successfully!')

        print('📦 Listing first 5 datasets from Kaggle (public):')
        datasets = api.dataset_list(page=1, page_size=5)
        for ds in datasets:
            print(f"- {ds.ref} (title: {ds.title})")

        print('📁 Testing dataset download for supermarket_sales...')
        os.makedirs('data', exist_ok=True)
        api.dataset_download_files('aungpyaeap/supermarket-sales', path='data', unzip=True)
        print('✅ Dataset downloaded and unzipped in ./data/')

    except Exception as e:
        print('❌ Kaggle API setup failed:', e)


if __name__ == '__main__':
    main()
