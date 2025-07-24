# Moving Tags App

_QR code on the box, static app for checkpoints. Is everything in the truck?_

This is an Angular application designed to help you stay organized during your move. With this app, you can:

- Create a checklist of items to pack.
- Attach photos and comments to each item.
- Use tags to categorize and search for items.
- Generate and scan QR codes to track boxes.
- Update the status of each box as you move.
- This app is perfect for anyone who wants to take the stress out of moving!

## Fast deploy with https

(needed for camera permissions on phone)

```bash
docker build --network=host --build-arg BASE_HREF=/ -t moving-tags .
docker run --rm --network=host -p 8080:8080 moving-tags
ssh -R 80:localhost:8080 nokey@localhost.run
```

quick test with ng serve\
For security reason, vite needs to be configured to allow this domain name (changing each time)

```bash
ssh -R 80:localhost:8080 nokey@localhost.run
#add 52193a5fcb7265.lhr.life to moving-tags/angular.json
#projects → moving-tags → architect → serve → options → allowedHosts
ng serve --host=0.0.0.0 --disable-host-check
```

running unit tests

```bash
sudo apt-get update && sudo apt-get install -y chromium
export CHROME_BIN=$(which chromium)
cd /workspaces/moving-tags/moving-tags
ng test
```
