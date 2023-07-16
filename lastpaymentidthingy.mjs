import fs from 'fs'; //file system controller duh
import fetch from 'node-fetch'; // Import the fetch function from the 'node-fetch' package
import Gpio from 'onoff'; //gpio pin controller

class PaymentTracker { //main program lol
  constructor() {
    const config = this.readConfigFile(); //reads config 
    this.accessToken = config.SQUARE_ACCESS_TOKEN; //takes token from config to put here CHANGE THE TOKEN IN CONFIG BEFORE USAGE 
    this.apiUrl = 'https://connect.squareupsandbox.com/v2/payments'; //if it is connect.squareupsandbox.com then it is sandbox (no shit sherlock)
    this.previousPaymentId = null; //payment id 
    this.previousPaymentStatus = null; //status of the payment
    this.previousPaymentSourceType = null; //what kind of payment type used like card gift card etc
    this.lastPaymentId = null;
    this.lastPaymentLast4 = null;
    this.mosfetControl = new MosfetControl(); 
    this.isMosfetTriggered = false; // Add a new property to track if Mosfet has been triggered
  }
  readConfigFile() {
    try {
      const rawData = fs.readFileSync('config.json');
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error reading config.json:', error);
      process.exit(1);
    }
  }
  async fetchPayments() {
    const response = await fetch(this.apiUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (Array.isArray(data.payments) && data.payments.length > 0) {
      data.payments.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const lastPayment = data.payments[0];
      const newPaymentId = lastPayment.id;
      const newPaymentStatus = lastPayment.status;
      const newPaymentSourceType = lastPayment.source_type;
      const newPaymentLast4 = this.getLast4Digits(newPaymentId);
      
      if (newPaymentId !== this.previousPaymentId) {
        const oldPaymentDetails = {
          status: this.previousPaymentStatus,
          id: this.previousPaymentId,
          sourceType: this.previousPaymentSourceType,
          last4: this.previousPaymentLast4
        };
  
        const newPaymentDetails = {
          status: newPaymentStatus,
          id: newPaymentId,
          sourceType: newPaymentSourceType,
          last4: newPaymentLast4
        };
  
        if (
          newPaymentStatus === 'APPROVED' ||
          newPaymentStatus === 'COMPLETED' ||
          newPaymentStatus === 'PENDING'
        ) {
          if (this.previousPaymentId !== null) {
            this.mosfetControl.triggerPin1(); // Trigger GPIO pin 1 (Physical pin 28)
            this.isMosfetTriggered = true;
          }
        } else if (newPaymentStatus === 'CANCELED' || newPaymentStatus === 'FAILED') {
          this.mosfetControl.triggerPin12(); // Trigger GPIO pin 12 (Physical pin 32)
          this.isMosfetTriggered = false;
  
          if (newPaymentStatus === 'FAILED' || newPaymentStatus === 'CANCELED') {
            this.logPaymentDetails(oldPaymentDetails, newPaymentDetails, this.isMosfetTriggered);
          }
        }

        const oldPaymentId = this.previousPaymentId;
        const oldPaymentStatus = this.previousPaymentStatus;
        const oldPaymentSourceType = this.previousPaymentSourceType;
        const oldPaymentLast4 = this.lastPaymentLast4;

        this.previousPaymentId = newPaymentId;
        this.previousPaymentStatus = newPaymentStatus;
        this.previousPaymentSourceType = newPaymentSourceType;
        this.lastPaymentId = newPaymentId;
        this.lastPaymentLast4 = newPaymentLast4;

        const paymentData = {
          newPaymentId: this.getShortenedId(newPaymentId),
          oldPaymentId: this.getShortenedId(oldPaymentId),
          newPaymentStatus: newPaymentStatus,
          oldPaymentStatus: oldPaymentStatus,
          newPaymentSourceType: newPaymentSourceType,
          oldPaymentSourceType: oldPaymentSourceType,
          newPaymentLast4: newPaymentLast4,
          oldPaymentLast4: oldPaymentLast4,
          isMosfetTriggered: this.isMosfetTriggered // Add the Mosfet triggered flag to the paymentData object
        };

        this.savePaymentData(paymentData);

        if (newPaymentLast4 === oldPaymentLast4) {
          console.log('Last 4 digits of payment ID are the same');
        }
      }
    } else {
      console.log('No payments found');
    }
  }

  getShortenedId(paymentId) {
    if (paymentId !== null) {
      return paymentId.slice(-6);
    } else {
      return 'null';
    }
  }

  getLast4Digits(paymentId) {
    if (paymentId !== null) {
      return paymentId.slice(-4);
    } else {
      return 'null';
    }
  }

  savePaymentData(paymentData) {
    const jsonData = JSON.stringify(paymentData, null, 2);

    fs.writeFile('response.json', jsonData, (err) => {
      if (err) {
        console.error('Error writing to response.json:', err);
      } else {
        console.log('Payment data saved to response.json');
      }
      
    });
  }

  startTracking() {
    setInterval(() => this.fetchPayments(), 1000);
  }
}

class MosfetControl {
  constructor() {
    this.pin1 = new Gpio(1, 'out'); // Use GPIO pin 1 (Physical pin 28) for Mosfet trigger
    this.pin12 = new Gpio(12, 'out'); // Use GPIO pin 12 (Physical pin 32) for failed payment trigger
  }

  triggerPin1() {
    this.pin1.writeSync(1); // Set GPIO pin 1 to HIGH
    console.log('Payment ID changed. Triggering MosfetControl for GPIO pin 1...');
  }

  triggerPin12() {
    this.pin12.writeSync(1); // Set GPIO pin 12 to HIGH
    console.log('Payment status changed to CANCELED or FAILED. Triggering MosfetControl for GPIO pin 12...');
  }
}


const paymentTracker = new PaymentTracker();
paymentTracker.startTracking();