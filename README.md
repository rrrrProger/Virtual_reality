Lab 3 Virtual Reality.
Orienting in space using gyroscope (Variant 3)

Installed Server Start app on the phone:

![Alt text](images/image.png)

Read data from the gyroscope on the phone by WebSocket:
```
const socket = new WebSocket('ws://Pixel-4.netis:8080/sensor/connect?type=android.sensor.gyroscope');
```
Then computing rotation vector and with help of rotation vector computing rotation matrix. Multiply rotation matrix by modelview matrix and got final rotation.
Added video of me rotating the phone and the surface rotating.

![Alt text](images/screencapture.gif)