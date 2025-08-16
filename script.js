  class WebSocketManager {
    constructor() {
        this.ip = 'esp32.local';
        this.webSocket = null;
        this.isConnected = false;
        this.connect();
    }

    connect() {
        this.webSocket = new WebSocket(`ws://${this.ip}:81`);
        
        this.webSocket.onopen = () => {
            this.isConnected = true;
            this.socketStatus('Conectado ao ESP32');
            console.log('Conectado ao ESP32');
        }

        this.webSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.statusUpdate(data);
            } catch(err) {
                console.error('Erro ao parsear JSON:', err);
            }
        };

        this.webSocket.onclose = () => {
            this.isConnected = false;
            this.socketStatus('Desconectado');
            console.log('Desconectado. Reconectando...');
            setTimeout(() => this.connect(), 5000);
        };

        this.webSocket.onerror = (error) => {
            this.isConnected = false;
            this.socketStatus('Erro de conexão');
            console.error('Erro na conexão WebSocket:', error);
        };
    }

    socketStatus(text) {
        const ipSpan = document.getElementById('ip');
        ipSpan.textContent = text;
    }

    statusUpdate(data) {
        //Status geral
        if(data.temp !== undefined) document.getElementById('temp').textContent = data.temp + ' °C';
        if(data.ip !== undefined) document.getElementById('ip').textContent = data.ip;
        if(data.led !== undefined) document.getElementById('ledState').textContent = data.led ? 'Ligado' : 'Desligado';
        if(data.ble !== undefined) document.getElementById('ble').textContent = data.ble ? 'Ativo' : 'Inativo';
        if(data.uptime !== undefined) document.getElementById('uptime').textContent = data.uptime;
        if(data.rssi !== undefined) document.getElementById('rssi').textContent = data.rssi + ' dBm';
        if(data.heapUsed !== undefined && data.heapTotal !== undefined) document.getElementById('heap').textContent = data.heapUsed + ' KB / ' + data.heapTotal + ' KB';
        if(data.flashUsed !== undefined && data.flashTotal !== undefined) document.getElementById('flash').textContent = data.flashUsed + ' MB / ' + data.flashTotal + ' MB';

        // Sensores e botões
        if(data.btn1 !== undefined) document.getElementById('btn1Status').textContent = data.btn1 ? 'Pressionado' : 'Solto';
        if(data.btn2 !== undefined) document.getElementById('btn2Status').textContent = data.btn2 ? 'Pressionado' : 'Solto';
        if(data.btn3 !== undefined) document.getElementById('btn3Status').textContent = data.btn3 ? 'Pressionado' : 'Solto';
        if(data.sensorTemp !== undefined) document.getElementById('sensorTemp').textContent = data.sensorTemp + ' °C';
        if(data.wifiSSID !== undefined) document.getElementById('wifiSSID').textContent = data.wifiSSID;
        if(data.wifiRSSI !== undefined) document.getElementById('wifiRSSI').textContent = data.wifiRSSI + ' dBm';
    }     

    sendCommand(cmd, value) {
        if(this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.send(JSON.stringify({ command: cmd, value: value }));
        } else {
            console.warn('WebSocket não está conectado.');
        }
    }
  }

  class ColorPicker {
    constructor(sendCommand) {
      this.canvas = document.getElementById('colorWheel');
      this.ctx = this.canvas.getContext('2d');
      this.pickerCircle = document.getElementById('pickerCircle');
      this.radius = this.canvas.width / 2;
      this.center = { x: this.radius, y: this.radius };
      this.sendDebounceTimeout = 10;
      this.sendTimeout = null;
      this.dragging = false;
      this.sendCommand = sendCommand;

      this.drawColorWheel();
      this.updatePickerPosition(90, 90, false);

      this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
      window.addEventListener('mouseup', this.onMouseUp.bind(this));
      window.addEventListener('mousemove', this.onMouseMove.bind(this));
      this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
      window.addEventListener('touchend', this.onTouchEnd.bind(this));
      window.addEventListener('touchmove', this.onTouchMove.bind(this));
    }

    drawColorWheel() {
      const image = this.ctx.createImageData(this.canvas.width, this.canvas.height);
      for(let x = 0; x < this.canvas.width; x++) {
        for(let y = 0; y < this.canvas.height; y++) {
          const dx = x - this.center.x;
          const dy = y - this.center.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if(dist <= this.radius) {
            const angle = Math.atan2(dy, dx) + Math.PI;
            const hue = angle / (2 * Math.PI) * 359;
            const saturation = dist / this.radius;
            const [r, g, b] = this.hsvToRgb(hue, saturation, 1);
            const idx = (y * this.canvas.width + x) * 4;
            image.data[idx] = r;
            image.data[idx + 1] = g;
            image.data[idx + 2] = b;
            image.data[idx + 3] = 255;
          } else {
            const idx = (y * this.canvas.width + x) * 4;
            image.data[idx + 3] = 0;
          }
        }
      }
      this.ctx.putImageData(image, 0, 0);
    }

    hsvToRgb(h, s, v) {
      let c = v * s;
      let hp = h / 60;
      let x = c * (1 - Math.abs(hp % 2 -1));
      let r=0, g=0, b=0;

      if(hp >= 0 && hp < 1) [r,g,b] = [c,x,0];
      else if(hp < 2) [r,g,b] = [x,c,0];
      else if(hp < 3) [r,g,b] = [0,c,x];
      else if(hp < 4) [r,g,b] = [0,x,c];
      else if(hp < 5) [r,g,b] = [x,0,c];
      else if(hp < 6) [r,g,b] = [c,0,x];

      let m = v - c;
      r = Math.round((r + m)*255);
      g = Math.round((g + m)*255);
      b = Math.round((b + m)*255);
      return [r,g,b];
    }

    updatePickerPosition(x, y, send=true) {
      const dx = x - this.center.x;
      const dy = y - this.center.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      let px, py;

      if(dist > this.radius) {
        const angle = Math.atan2(dy, dx);
        px = this.center.x + this.radius * Math.cos(angle);
        py = this.center.y + this.radius * Math.sin(angle);
      } else {
        px = x;
        py = y;
      }

      this.pickerCircle.style.left = (px - this.pickerCircle.offsetWidth/2) + 'px';
      this.pickerCircle.style.top = (py - this.pickerCircle.offsetHeight/2) + 'px';

      const angle = Math.atan2(py - this.center.y, px - this.center.x) + Math.PI;
      const hue = angle / (2 * Math.PI) * 360;
      const saturation = Math.min(1, Math.sqrt((px - this.center.x)**2 + (py - this.center.y)**2) / this.radius);
      const value = 1;

      const [r,g,b] = this.hsvToRgb(hue, saturation, value);
      this.pickerCircle.style.backgroundColor = `rgb(${r},${g},${b})`;

      document.getElementById('rgb').innerHTML = `[<span id="red">${r}</span>, <span id="green">${g}</span>, <span id="blue">${b}</span>]`;
      document.getElementById('green').style.color = `rgb(0, ${g}, 0)`;
      document.getElementById('blue').style.color = `rgb(0, 0, ${b})`;
      document.getElementById('red').style.color = `rgb(${r}, 0, 0)`;

      if(this.sendTimeout) clearTimeout(this.sendTimeout);
      if(!send) return;
      this.sendTimeout = setTimeout(() => {
        this.sendCommand('ledRgbColor', { r, g, b });
      }, this.sendDebounceTimeout);
    }

    onMouseDown(e) {
      this.dragging = true;
      const rect = this.canvas.getBoundingClientRect();
      this.updatePickerPosition(e.clientX - rect.left, e.clientY - rect.top);
    }

    onMouseUp() {
      this.dragging = false;
    }

    onMouseMove(e) {
      if(this.dragging) {
        const rect = this.canvas.getBoundingClientRect();
        this.updatePickerPosition(e.clientX - rect.left, e.clientY - rect.top);
      }
    }

    onTouchStart(e) {
      this.dragging = true;
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      this.updatePickerPosition(touch.clientX - rect.left, touch.clientY - rect.top);
    }

    onTouchEnd() {
      this.dragging = false;
    }

    onTouchMove(e) {
      if(this.dragging) {
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        this.updatePickerPosition(touch.clientX - rect.left, touch.clientY - rect.top);
      }
    }
  }

  const socketManager = new WebSocketManager();
  const colorPicker = new ColorPicker(socketManager.sendCommand.bind(socketManager));

  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(b => b.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // --- LED --- //
  const ledToggle = document.getElementById('ledToggle');
  const ledBrightness = document.getElementById('ledBrightness');
  const ledMode = document.getElementById('ledMode');

  ledToggle.addEventListener('change', () => {
      socketManager.sendCommand('ledToggle', ledToggle.checked);
  });

  ledBrightness.addEventListener('input', () => {
      socketManager.sendCommand('ledBrightness', parseInt(ledBrightness.value));
  });

  ledMode.addEventListener('change', () => {
      socketManager.sendCommand('ledMode', ledMode.value );
  });

  // --- Motor --- //
  const motorToggle = document.getElementById('motorToggle');
  const motorSpeed = document.getElementById('motorSpeed');
  const motorTimer = document.getElementById('motorTimer');
  const motorTimerStart = document.getElementById('motorTimerStart');
  const motorInvert = document.getElementById('motorInvert');

  motorToggle.addEventListener('click', () => {
      const ligar = motorToggle.textContent.includes('Ligar');
      socketManager.sendCommand('motorToggle', ligar);
      motorToggle.textContent = ligar ? 'Desligar Motor' : 'Ligar Motor';
  });

  motorSpeed.addEventListener('input', () => {
      socketManager.sendCommand('motorSpeed', parseInt(motorSpeed.value));
  });

  motorTimerStart.addEventListener('click', () => {
      const tempo = parseInt(motorTimer.value);
      if (tempo > 0) {
        socketManager.sendCommand('motorTimerStart', tempo);
      }
  });

  motorInvert.addEventListener('click', () => {
      socketManager.sendCommand('motorInvert', {});
  });

  // --- Buzzer --- //
  const buzzerToggle = document.getElementById('buzzerToggle');
  const volumeControl = document.getElementById('volumeControl');
  const buzzerTone = document.getElementById('buzzerTone');
  const buzzerTest = document.getElementById('buzzerTest');

  buzzerToggle.addEventListener('click', () => {
      const ligar = buzzerToggle.textContent.includes('Ligar');
      socketManager.sendCommand('buzzerToggle', ligar);
      buzzerToggle.textContent = ligar ? 'Desligar Buzzer' : 'Ligar Buzzer';
  });

  volumeControl.addEventListener('input', () => {
      socketManager.sendCommand('buzzerVolume', parseInt(volumeControl.value));
  });

  buzzerTone.addEventListener('change', () => {
      socketManager.sendCommand('buzzerTone', buzzerTone.value);
  });

  buzzerTest.addEventListener('click', () => {
      socketManager.sendCommand('buzzerTest', {});
  });

  // --- Reset Sistema --- //
  const resetBtn = document.getElementById('resetBtn');
  resetBtn.addEventListener('click', () => {
      if(confirm('Tem certeza que quer resetar o sistema?')) {
        socketManager.sendCommand('systemReset', {});
      }
  });

  // --- Configurações Wi-Fi --- //
  const wifiReset = document.getElementById('wifiReset');
  wifiReset.addEventListener('click', () => {
      if(confirm('Resetar as configurações Wi-Fi?')) {
        socketManager.sendCommand('wifiReset', {});
      }
  });

  // --- Configurações BLE --- //
  const bleToggle = document.getElementById('bleToggle');
  const bleName = document.getElementById('bleName');
  const bleVisibility = document.getElementById('bleVisibility');
  const bleApply = document.getElementById('bleApply');

  bleToggle.addEventListener('change', () => {
      socketManager.sendCommand('bleToggle', bleToggle.checked);
  });

  bleApply.addEventListener('click', () => {
      socketManager.sendCommand('bleConfig', {
        name: bleName.value,
        visibility: bleVisibility.value,
      });
  });

  // --- Configurações LED (separado) --- //
  const configLedBrightness = document.getElementById('configLedBrightness');
  const configLedMode = document.getElementById('configLedMode');
  const configLedApply = document.getElementById('configLedApply');

  configLedApply.addEventListener('click', () => {
      socketManager.sendCommand('configLed', {
        brightness: parseInt(configLedBrightness.value),
        mode: configLedMode.value,
      });
  });