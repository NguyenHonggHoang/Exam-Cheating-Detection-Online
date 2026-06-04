import urllib.request
import urllib.parse
import json
import sys

def main():
    try:
        # Step 1: Get Token
        url_auth = 'http://authorization-server:9000/oauth2/token'
        data = urllib.parse.urlencode({'grant_type': 'client_credentials'}).encode('utf-8')
        req_auth = urllib.request.Request(
            url_auth,
            data=data,
            headers={
                'Authorization': 'Basic c2Vzc2lvbi1zZXJ2aWNlOnNlc3Npb24tc2VjcmV0',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        )
        res_auth = urllib.request.urlopen(req_auth)
        token = json.loads(res_auth.read().decode('utf-8'))['access_token']
        print('Token successfully obtained!')
        
        # Step 2: Request Paged Questions
        url_paged = 'http://session-service:8081/api/mock-exam/e1000000-0000-0000-0000-000000000001/questions/paged?page=0&size=20'
        print(f'Requesting: {url_paged}')
        req_paged = urllib.request.Request(
            url_paged,
            headers={'Authorization': 'Bearer ' + token}
        )
        try:
            res_paged = urllib.request.urlopen(req_paged)
            print('Paged Response Status:', res_paged.status)
            print('Paged Response Body:', res_paged.read().decode('utf-8')[:500])
        except urllib.error.HTTPError as e:
            print('Paged HTTP Error:', e.code, e.reason)
            print('Paged Error Body:', e.read().decode('utf-8'))
            
        # Step 3: Request Full Questions (cached)
        url_full = 'http://session-service:8081/api/mock-exam/e1000000-0000-0000-0000-000000000001/questions'
        print(f'Requesting: {url_full}')
        req_full = urllib.request.Request(
            url_full,
            headers={'Authorization': 'Bearer ' + token}
        )
        try:
            res_full = urllib.request.urlopen(req_full)
            print('Full Response Status:', res_full.status)
            print('Full Response Body:', res_full.read().decode('utf-8')[:500])
        except urllib.error.HTTPError as e:
            print('Full HTTP Error:', e.code, e.reason)
            print('Full Error Body:', e.read().decode('utf-8'))
            
    except Exception as ex:
        print('Global Exception:', ex)

if __name__ == '__main__':
    main()
