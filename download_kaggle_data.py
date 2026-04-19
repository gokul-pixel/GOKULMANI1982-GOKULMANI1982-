from app import kaggle_manager

if __name__ == '__main__':
    print('Downloading Kaggle datasets...')
    for key in kaggle_manager.datasets.keys():
        print(f'--> {key}')
        result = kaggle_manager.download_dataset(key)
        if result.get('status') == 'success':
            print(f"    ✓ {result.get('message')} (file: {result.get('file')})")
        else:
            print(f"    ✗ {result.get('message')}")
    print('Done.')
