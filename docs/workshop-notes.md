# Workshop Notes: Gastos
Date: 2026-05-31

## Product Purpose
A shared expense-tracking web app for a couple, designed to help them spend less month-to-month by logging all expenses in real time and enforcing budget limits by category and group.

## Target User
Facundo and his girlfriend, each logging expenses independently from their own device.

## Core Problem
Spreadsheets and Notion are too manual and have no budget enforcement. There is no easy shared view of spending accessible from two different devices.

## Evidence of Demand
Personal use case — the users are the target audience.

## Narrowest Wedge
An "add expense" screen: log amount, currency, category, payment method, and optional installments. That is the screen they would open every day.

## Core Concepts
- **Expense**: A single purchase logged by one person (never shared between both users). Has: amount, currency, category, payment method, and optional installments. _Avoid_: "transaction," "charge."
- **Category**: The type of expense (e.g., "Car," "Food," "Entertainment"). Always belongs to one Group. _Avoid_: "Type."
- **Group**: The broad bucket a Category belongs to (e.g., "Fixed Expenses," "Non-Primary Expenses"). _Avoid_: "Super Type."
- **Payment Method**: How the expense was paid — Cash, Bank Account, or Credit/Debit Card. If card, installments become available. _Avoid_: "payment type."
- **Installments**: The number of monthly payments a credit card expense is split into. _Avoid_: "quotes," "cuotas."
- **Budget Limit**: A spending cap set on a Category or Group, with remaining balance visible at any point in time. _Avoid_: "budget."
- **Currency**: The denomination of the expense. Multiple currencies are supported.

## Out of Scope
- Bill splitting or shared expenses (each expense belongs to exactly one person)
- Native mobile apps (web browser only)
- Forecasting, analytics, or grouped views (future work)

## Open Questions
- Which currencies are used most frequently?
- Should Budget Limits reset monthly, or are they rolling?
