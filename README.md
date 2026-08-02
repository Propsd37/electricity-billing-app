# Rent & Electricity Billing App

A simple app to manage property rent collection and electricity billing
based on sub-meter readings.

## Features

- **Property Types** with configurable electricity rates (per unit)
- **Property Management** - Add units (1BHK, 2BHK, 1RK, Asbestos, Shop)
- **Tenant Management** - Track active/inactive tenants
- **Meter Readings** - Enter monthly readings, auto-calculates bills
- **Bill Generation** - Auto-generates rent + electricity combined bills
- **Payment Tracking** - Mark bills as paid/unpaid
- **Dashboard** - Monthly summary, pending payments overview

## How to Run

```bash
cd electricity-billing-app
npm install
npm start
```

Open http://localhost:3000 in your browser.

## Default Electricity Rates

| Property Type   | Rate (per unit) |
|----------------|-----------------|
| 1 BHK          | Rs. 8/unit      |
| 2 BHK          | Rs. 8/unit      |
| 1 RK           | Rs. 7/unit      |
| Asbestos House | Rs. 6/unit      |
| Shop           | Rs. 10/unit     |

You can change these rates in Settings.

## Monthly Workflow

1. Go to **Settings** - adjust rates if needed
2. Go to **Properties** - add your properties
3. Go to **Tenants** - add tenants and assign to properties
4. Each month, go to **Meter Readings** - enter current reading
5. Bills are auto-generated (rent + electricity)
6. Track payments in **Bills** or **Dashboard**

## Data Storage

All data is stored in `data/billing.db` (SQLite file).
No internet needed - works completely offline.
