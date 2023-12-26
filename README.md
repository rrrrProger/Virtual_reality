# Lab 2 Virtual Reality

WebGL is used as main library. 
Work examples:
First initial position:
![image-7.png](images/image-7.png)
In the right top corner there are parameters that can be changed (FOV, cameraX, cameraY, cameraZ, aspect ratio, znear, zfar, eye_seperation - distance between the eyes, convergence)
For example let's try to change FOV, ratio and znear and apply left and right frustum
Let's try to change some params:
With changed FOV:
![image-8.png](images/image-8.png)

Let's add texture video:
Function loadWebCamTexture() setups web cam texture. Because of virtual camera (OBS) on the computer attempt of capturing video from camera by navigator.mediaDevices was unsuccessful.

![image-9.png](images/image-9.png)

Was added interval to play video:

From main():   
    setInterval(draw, 1/20);

Another frames from the video:

![image-10.png](images/image-10.png)

![image-11.png](images/image-11.png)

Gif presenting video in texture:

![lab2_capture.gif](images/lab2_capture.gif)