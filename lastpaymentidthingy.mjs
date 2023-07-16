import fs from 'fs';
import fetch from 'node-fetch'; // Import the fetch function from the 'node-fetch' package

class PaymentTracker {
  constructor() {
    const config = this.readConfigFile();
    this.accessToken = config.SQUARE_ACCESS_TOKEN;
    this.apiUrl = 'https://connect.squareupsandbox.com/v2/payments';
    this.previousPaymentId = null;
    this.previousPaymentStatus = null;
    this.previousPaymentSourceType = null;
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
        console.log(`Payment ID changed from ${this.getShortenedId(this.previousPaymentId)} to ${this.getShortenedId(newPaymentId)}`);
        if (
          newPaymentStatus === 'APPROVED' ||
          newPaymentStatus === 'COMPLETED'
        ) {
          if (this.previousPaymentId !== null) { // Add this condition
            this.mosfetControl.trigger();
            this.isMosfetTriggered = true;
          }
        } else {
          this.isMosfetTriggered = false;
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
  constructor() {}

  trigger() {
    console.log('Payment ID changed. Triggering MosfetControl...');
  }
}

const paymentTracker = new PaymentTracker();
paymentTracker.startTracking();