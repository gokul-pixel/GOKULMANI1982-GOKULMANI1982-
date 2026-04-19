import urllib.request as u

urls = [
    'http://127.0.0.1:5000/',
    'http://127.0.0.1:5000/health',
    'http://127.0.0.1:5000/status',
    'http://127.0.0.1:5000/settings',
]

print('Running smoke test...')
any_errors = False
for url in urls:
    try:
        r = u.urlopen(url, timeout=5)
        print(url, '->', r.getcode())
    except Exception as e:
        any_errors = True
        print(url, '-> ERROR:', e)

if any_errors:
    raise SystemExit('Some endpoints failed. Check server logs and routes.')

print('Smoke test completed successfully.')
