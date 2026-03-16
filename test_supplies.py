import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

data = json.dumps({"username":"admin","password":"123"}).encode('utf-8')
req = urllib.request.Request('https://openeats.onrender.com/api/auth/token/', data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req, context=ctx) as res:
        token = json.loads(res.read())['access']
        print("Logged in")
        
    req2 = urllib.request.Request('https://openeats.onrender.com/api/supplies/?is_active=true', headers={'Authorization': 'Bearer ' + token})
    with urllib.request.urlopen(req2, context=ctx) as res:
        supplies = json.loads(res.read())
        print('Total supplies:', len(supplies))
        if supplies:
            print('First supply sample:', supplies[0])
except Exception as e:
    print('Failed:', e)
    if hasattr(e, 'read'):
        print(e.read().decode('utf-8'))
