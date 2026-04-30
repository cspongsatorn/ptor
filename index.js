require('dotenv').config();
const mqtt = require('mqtt');
const mysql = require('mysql2');
const express = require('express');

const app = express();
app.use(express.json());

/* =======================
   MySQL Connection (SSL)
======================= */

const db = mysql.createConnection({
  host: 'mysql-318ae614-ohhotor-f918.h.aivencloud.com',
  port: 17645,
  user: 'avnadmin',
  password: process.env.DB_PASS,
  database: 'defaultdb',
  ssl: {
    rejectUnauthorized: true,
    ca: `-----BEGIN CERTIFICATE-----
MIIERDCCAqygAwIBAgIURsxJUjaErMySq/TRjDHkonU1oPgwDQYJKoZIhvcNAQEM
BQAwOjE4MDYGA1UEAwwvM2FlNWQ5OTItNzgyYy00N2IwLWFkMDAtM2VjNWUxYTYw
Y2Q2IFByb2plY3QgQ0EwHhcNMjYwNDI5MDM0NzI4WhcNMzYwNDI2MDM0NzI4WjA6
MTgwNgYDVQQDDC8zYWU1ZDk5Mi03ODJjLTQ3YjAtYWQwMC0zZWM1ZTFhNjBjZDYg
UHJvamVjdCBDQTCCAaIwDQYJKoZIhvcNAQEBBQADggGPADCCAYoCggGBALLplNEe
ybhivUWenGyZuE3EhrPo0CAzdysE0M6C5RtE6XZz0fqCA70OysJ33aroSF0XZFOq
LmuDEQ4IiPPVcy8OrLIE0nfSuWdQL51DwVCRQKoQaewUfEXNH5Jr50dCPADU/LOY
pZ4mFK97/wS8kL3U6Yrwt4ZZy3eigqq+NXqRnYNnc7bDR82ySO0OCzYhcHPYtEBC
bnnLilNID0H3Yp4j0o+fA5A5P9l9biCumE/0rPOqu6BzkcvqnJ8jsOE6NiBRUtvz
v/iZa2um+C9ZsndTj+G4BK5i+knYBvI/TwOBAWIuxadcL4qnl1LEOZ57UXlyUBe2
qBfPgMhKKznm2Po8qaDQF/LmGOh7VJp3v2LSCsHt91BvklDfcXI9xKvmYh3B5g9I
2le7cwSnUbiPHMxR8DZZ2c2/sj9434L+kv8QF/39Ly2QxQug0814mfHlPsZu6NjI
jfg8rSPCbUQUY7b/oeU8d7uBia0M1Id+1ST5w5pmC6S8B9/Oyjsk85qIdwIDAQAB
o0IwQDAdBgNVHQ4EFgQUa7VZYC8R2CPQ/h84CHftr/CMdSowEgYDVR0TAQH/BAgw
BgEB/wIBADALBgNVHQ8EBAMCAQYwDQYJKoZIhvcNAQEMBQADggGBAEk22RIV7f1N
2x2oTnkMVITIPaf4rr+lFn1ni2pn017Et4xqYkKi4bZxj2Cg0oSybGQjjEIwgTPv
cW+wrUjbOShyvv5wdZlzB5R45oFFClL3uI1GMO9TcYQrApiPoGWlrHtAHaLCqS+5
M3F84q67kmv/jTChnu4N+ihIP+QCY1uK5YFHRGREeqY+qhzzzCtPJ6mOzeX9xdYt
OSgHr1UxHOZahM837usR7/LDdwqP1IDvCbEjcT0MyYV6RAzFBygUrOqggdq8uaYe
apvywaS9WvGNPcrE8Lhl9vuShOZqlac56YgCCv7i+X1nAdFUM+Aqlp/3+586CeAl
Vja+Pw7zDOA7R6qyxeWdeo1/bwgY1Y0/yZaUqD3SuRDuFN0pT7aKHIiQXKtGGTLN
pD0FwKESsVDpP/Cnrj+S1kTvmh/rPh8By7OKh274rRmIKdHxFZKkB8HDa3cSW/gA
1x7rOZ93KUOI8toiehbX+/DDUQgRbKaR2QIUKLGhzliw3reG5s76bw==
-----END CERTIFICATE-----`
  }
});

db.connect(err => {
  if (err) {
    console.error('DB Error:', err);
    return;
  }
  console.log('MySQL Connected');
});

/* =======================
   MQTT Connection
======================= */

const mqttClient = mqtt.connect('mqtt://broker.freemqtt.com:1883', {
  username: 'freemqtt',
  password: 'public'
});

mqttClient.on('connect', () => {
  console.log('MQTT Connected');

  // subscribe topic (แก้ตามที่คุณใช้)
  mqttClient.subscribe('Air/AQ01', err => {
    if (err) console.error(err);
  });
});

/* =======================
   รับข้อมูลจาก MQTT
======================= */

mqttClient.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());

    const sql = `
      INSERT INTO AirQuality1 
      (device_ID, pm1_0, pm2_5, pm10, CO2, temp2, hum, date_at)
      VALUES (?, ?, ?, ?, ?, ?, ?,NOW())
    `;

    const values = [
      data.devid,
      data["pm1.0"],
      data["pm2.5"],
      data.pm10,
      data.co2,
      data.temp,
      data.humi
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error('Insert Error:', err);
      } else {
        console.log('Saved:', data.devid);
      }
    });

  } catch (err) {
    console.error('MQTT Parse Error:', err);
  }
});

/* =======================
   API
======================= */

/* 🔹 ดึงค่าล่าสุดทุก device */
app.get('/latest/:id', (req, res) => {
    const id = req.params.id;
  
    // map id → device_ID
    const deviceMap = {
      1: 'AQ01001',
      2: 'AQ01002',
      3: 'AQ01003'
    };
  
    const deviceId = deviceMap[id];
  
    if (!deviceId) {
      return res.status(400).json({ error: 'Invalid device id' });
    }
  
    const sql = `
      SELECT pm1_0 AS 'PM1.0',pm2_5 AS 'PM2.5',pm10,CO2,temp2 AS temp,hum AS humi FROM AirQuality1
      WHERE device_ID = ?
      ORDER BY date_at DESC
      LIMIT 1
    `;
  
    db.query(sql, [deviceId], (err, result) => {
      if (err) return res.status(500).send(err);
      res.json(result[0] || {});
    });
  });

/* 🔹 ดึงข้อมูลย้อนหลัง */
app.get('/history/:id', (req, res) => {
  const deviceId = req.params.id;

  const sql = `
    SELECT * FROM AirQuality
    WHERE device_ID = ?
    ORDER BY created_at DESC
    LIMIT 100
  `;

  db.query(sql, [deviceId], (err, result) => {
    if (err) return res.status(500).send(err);
    res.json(result);
  });
});

/* =======================
   Start Server
======================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
