class LaundryApp {
    constructor() {
        this.machines = {
            washer1: { type: 'washer', defaultTime: 30 },
            washer2: { type: 'washer', defaultTime: 30 },
            dryer1: { type: 'dryer', defaultTime: 60 },
            dryer2: { type: 'dryer', defaultTime: 60 }
        };
        
        this.currentMachine = null;
        this.setupEventListeners();
        this.checkNotificationPermission();
        this.loadMachineStates();
        
        // Add iOS NFC support
        if ('NFCNDEFReader' in window) {
            // Modern Android way
            this.setupModernNFC();
        } else if ('safari' in window && 'NDEFReader' in window.safari) {
            // iOS way
            this.setupIOSNFC();
        } else {
            console.log('NFC not supported - falling back to click handling');
            this.setupClickHandling();
        }
    }


    async setupModernNFC() {
        try {
            const reader = new NDEFReader();
            await reader.scan();
            reader.onreading = (event) => {
                const decoder = new TextDecoder();
                const text = decoder.decode(event.message.records[0].data);
                this.handleMachineScan(text);
            };
        } catch (error) {
            console.log('NFC error:', error);
            this.setupClickHandling(); // Fallback
        }
    }

    setupIOSNFC() {
        const scanButton = document.createElement('button');
        scanButton.textContent = 'Scan NFC Tag';
        scanButton.className = 'nfc-scan-button';
        document.querySelector('header').appendChild(scanButton);

        scanButton.addEventListener('click', async () => {
            try {
                const reader = new window.safari.NDEFReader();
                const message = await reader.scan();
                const decoder = new TextDecoder();
                const text = decoder.decode(message.records[0].data);
                this.handleMachineScan(text);
            } catch (error) {
                console.log('iOS NFC error:', error);
                alert('Error scanning NFC tag. Make sure NFC is enabled.');
            }
        });
    }

    setupClickHandling() {
        // Fallback for testing
        document.querySelectorAll('.machine').forEach(machine => {
            machine.addEventListener('click', () => {
                this.handleMachineScan(machine.id);
            });
        });
    }

    setupEventListeners() {
        // NFC reading setup
        if ('NDEFReader' in window) {
            const reader = new NDEFReader();
            reader.scan().then(() => {
                reader.onreading = event => {
                    const machineId = event.message.records[0].data;
                    this.handleMachineScan(machineId);
                };
            }).catch(error => {
                console.log('NFC reading error:', error);
            });
        }

        // Timer modal controls
        document.querySelector('.decrease').addEventListener('click', () => this.adjustTime(-5));
        document.querySelector('.increase').addEventListener('click', () => this.adjustTime(5));
        document.querySelector('.confirm').addEventListener('click', () => this.startTimer());
        document.querySelector('.cancel').addEventListener('click', () => this.hideModal());
    }

    async checkNotificationPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Notification permission denied');
            }
        }
    }

    handleMachineScan(machineId) {
        if (this.machines[machineId]) {
            this.currentMachine = machineId;
            const machine = this.machines[machineId];
            
            if (this.isMachineInUse(machineId)) {
                alert('This machine is currently in use');
                return;
            }

            document.getElementById('selected-time').textContent = machine.defaultTime;
            document.getElementById('timer-modal').classList.remove('hidden');
        }
    }

    adjustTime(minutes) {
        const timeSpan = document.getElementById('selected-time');
        let currentTime = parseInt(timeSpan.textContent);
        currentTime += minutes;
        
        // Ensure time is between 5 and 90 minutes
        currentTime = Math.min(Math.max(currentTime, 5), 90);
        timeSpan.textContent = currentTime;
    }

    startTimer() {
        if (!this.currentMachine) return;

        const minutes = parseInt(document.getElementById('selected-time').textContent);
        const endTime = new Date(Date.now() + minutes * 60000);
        
        this.setMachineState(this.currentMachine, {
            inUse: true,
            endTime: endTime.toISOString()
        });

        this.scheduleNotification(this.currentMachine, minutes);
        this.hideModal();
        this.updateUI();
    }

    scheduleNotification(machineId, minutes) {
        setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Laundry Almost Done!', {
                    body: `Your laundry in ${machineId} will be done in 10 minutes`,
                    icon: '/icon.png'
                });
            }
        }, (minutes - 10) * 60000);
    }

    setMachineState(machineId, state) {
        localStorage.setItem(machineId, JSON.stringify(state));
    }

    getMachineState(machineId) {
        const state = localStorage.getItem(machineId);
        return state ? JSON.parse(state) : null;
    }

    isMachineInUse(machineId) {
        const state = this.getMachineState(machineId);
        if (!state) return false;
        
        const endTime = new Date(state.endTime);
        return state.inUse && endTime > new Date();
    }

    loadMachineStates() {
        for (const machineId in this.machines) {
            const state = this.getMachineState(machineId);
            if (state) {
                const endTime = new Date(state.endTime);
                if (endTime <= new Date()) {
                    this.setMachineState(machineId, { inUse: false });
                }
            }
        }
        this.updateUI();
        setInterval(() => this.updateUI(), 60000); // Update every minute
    }

    updateUI() {
        for (const machineId in this.machines) {
            const machineElement = document.getElementById(machineId);
            const statusElement = machineElement.querySelector('.status');
            const timerElement = machineElement.querySelector('.timer');
            
            if (this.isMachineInUse(machineId)) {
                const state = this.getMachineState(machineId);
                const endTime = new Date(state.endTime);
                const minutesLeft = Math.ceil((endTime - new Date()) / 60000);
                
                statusElement.textContent = 'In Use';
                statusElement.classList.add('in-use');
                statusElement.classList.remove('available');
                
                timerElement.classList.remove('hidden');
                timerElement.querySelector('.time-left').textContent = 
                    `${minutesLeft} min${minutesLeft !== 1 ? 's' : ''} remaining`;
            } else {
                statusElement.textContent = 'Available';
                statusElement.classList.add('available');
                statusElement.classList.remove('in-use');
                timerElement.classList.add('hidden');
            }
        }
    }

    hideModal() {
        document.getElementById('timer-modal').classList.add('hidden');
        this.currentMachine = null;
    }
}

// Initialize app
window.addEventListener('load', () => {
    const app = new LaundryApp();
});
