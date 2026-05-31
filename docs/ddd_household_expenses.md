# DDD — Household Expenses App

---

## Bounded Context: Catalogue

> Defines the taxonomy for expense classification.

### SuperCategory `Aggregate Root`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | |
| description | string? | Optional |

**Examples:** "Fixed expense", "Variable expense"

---

### Category `Aggregate Root`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | |
| description | string? | Optional |
| superCategoryId | UUID | Reference to `SuperCategory` |

**Examples:** "Rent", "HOA fees", "Car", "Food", "Entertainment"

**Rule:** A `Category` always belongs to exactly one `SuperCategory`, but can be queried directly by its ID without going through it.

---

### ExchangeRate `Value Object`

| Field | Type | Notes |
|---|---|---|
| date | Date | Snapshot moment |
| pesosPerUsd | decimal | Pesos per USD |
| source | string | "manual", "api", etc. |

**Rule:** Immutable. Represents the exchange rate *at the time of the expense*, not the current one. Initially entered manually; in the future it may come from an API.

---

## Bounded Context: Payment Methods

> Models the instruments used to finance each expense.

### PaymentMethod `Abstract Entity`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| name | string | Descriptive name |
| type | MethodType | `CARD` \| `SAVINGS_ACCOUNT` |

Common base for `Card` and `SavingsAccount`.

---

### Card `Entity` *(extends PaymentMethod)*

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| cardName | string | E.g. "Visa Galicia" |
| brand | string? | E.g. "Visa", "Mastercard" |
| isDebit | boolean | `true` = debit, `false` = credit |

**Rule:** Cards are shared between both members of the household.

---

### SavingsAccount `Entity` *(extends PaymentMethod)*

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| bank | string | E.g. "Galicia", "Brubank" |
| currency | Currency | `ARS` \| `USD` |
| alias | string? | Optional |

**Rule:** If `currency = USD`, every expense paid from this account must record the `ExchangeRate` at the time of payment.

---

## Bounded Context: Expense Registration

> Core domain. Records, groups, and traces every expense.

### Expense `Aggregate Root`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| description | string | |
| date | Date | |
| originalAmount | decimal | In the expense's currency |
| currency | Currency | `ARS` \| `USD` |
| amountInPesos | decimal | Always calculated and persisted |
| exchangeRate | ExchangeRate? | Required if `currency = USD` |
| categoryId | UUID | Ref. to Catalogue BC |
| paymentMethodId | UUID | Ref. to Payment Methods BC |
| personId | UUID | Ref. to People BC |
| installmentPurchaseId | UUID? | Ref. if this is an installment |
| cardPayment | CardPayment? | Present if method = CARD |
| savingsAccountPayment | SavingsAccountPayment? | Present if method = SAVINGS_ACCOUNT |

**Business rules:**
- If `currency = USD` → `exchangeRate` is required.
- `cardPayment` and `savingsAccountPayment` are mutually exclusive.
- `amountInPesos` is always calculated and persisted (to preserve the historical record even if the exchange rate changes later).
- If the expense is an installment, `installmentPurchaseId` points to the parent aggregate.

---

### InstallmentPurchase `Aggregate Root`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| description | string | E.g. "Laptop in 12 installments" |
| totalAmount | decimal | Total purchase amount |
| numberOfInstallments | int | |
| cardId | UUID | Ref. to Payment Methods BC |
| installments | UUID[] | IDs of the generated Expenses |

**Rule:** When an `InstallmentPurchase` is created, the system automatically generates N `Expense` objects (one per installment), all linked to this aggregate. This allows viewing them individually in the history and grouping them for future analysis.

---

### CardPayment `Value Object`

| Field | Type | Notes |
|---|---|---|
| cardId | UUID | |
| isInstallment | boolean | |
| installmentDetail | InstallmentDetail? | Present if `isInstallment = true` |

Embedded inside `Expense` when the payment method is a card.

---

### InstallmentDetail `Value Object`

| Field | Type | Notes |
|---|---|---|
| installmentNumber | int | E.g. 3 |
| totalInstallments | int | E.g. 12 |

Embedded inside `CardPayment`. Allows displaying "installment 3 of 12" in the history.

---

### SavingsAccountPayment `Value Object`

| Field | Type | Notes |
|---|---|---|
| savingsAccountId | UUID | |
| currency | Currency | `ARS` \| `USD` |
| exchangeRate | ExchangeRate? | Required if `currency = USD` |

Embedded inside `Expense` when the payment method is a savings account. If the currency is USD, both values (dollars and pesos) are stored and displayed in the history.

---

## Bounded Context: People

> Identifies who registered each expense. Simple and decoupled.

### Person `Aggregate Root`

| Field | Type | Notes |
|---|---|---|
| id | UUID | |
| profile | PersonProfile | |

---

### PersonProfile `Value Object`

| Field | Type | Notes |
|---|---|---|
| name | string | |

---

## Shared Kernel

```
Currency    = ARS | USD
MethodType  = CARD | SAVINGS_ACCOUNT
```

---

## Cross-Context References

Contexts **never reference each other directly** — only by ID. This preserves decoupling.

| From | Field | Points to |
|---|---|---|
| `Expense` | `categoryId` | Catalogue BC → `Category` (direct Aggregate Root) |
| `Expense` | `paymentMethodId` | Payment Methods BC → `PaymentMethod` |
| `Expense` | `personId` | People BC → `Person` |
| `Expense` | `installmentPurchaseId` | Expense Registration BC → `InstallmentPurchase` |
| `InstallmentPurchase` | `cardId` | Payment Methods BC → `Card` |
| `CardPayment` | `cardId` | Payment Methods BC → `Card` |
| `SavingsAccountPayment` | `savingsAccountId` | Payment Methods BC → `SavingsAccount` |

---

## Glossary (Ubiquitous Language)

| Term | Definition |
|---|---|
| **Expense** | A record of money that left the household's funds |
| **InstallmentPurchase** | A purchase financed in installments that generates N related expenses |
| **Installment** | Each individual `Expense` generated by an `InstallmentPurchase` |
| **ExchangeRate** | Snapshot of the USD value at the moment an expense is recorded |
| **PaymentMethod** | The instrument used to pay: card or savings account |
| **SavingsAccount** | The bank account from which money was withdrawn when no card was used |
| **SuperCategory** | High-level grouping of categories (e.g. "Fixed expense") |
| **Category** | Specific classification of an expense (e.g. "Rent") |
| **Person** | Either of the two members of the household |
