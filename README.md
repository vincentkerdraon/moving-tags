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
