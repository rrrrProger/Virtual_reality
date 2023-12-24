const WebSocket = require('ws');
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

ws = new WebSocket('ws://Pixel-4.netis:8080/sensor/connect?type=android.sensor.gyroscope')

ws.addEventListener("message", (event) => {
    console.log("Message from server ", event.data);
  });