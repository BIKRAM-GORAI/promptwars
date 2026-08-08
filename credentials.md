# ResolveAI - Testing Credentials

This document lists the credentials and testing details to log in and simulate payments in the ResolveAI Store.

---

## 1. Admin Portal Credentials

Use the details below to log into the Admin Dashboard:
- **Admin Email**: `admin@resolveai.com`
- **Admin Password**: `adminpassword123`
- **Admin Portal URL**: `/pages/admin/dashboard.html`

*Note: For testing and evaluation, the Admin Panel authentication middleware automatically authorizes calls using the whitelisted bearer token: `resolveai-admin-session-token`.*

---

## 2. Customer Portal Credentials

These pre-registered customer profiles are seeded inside the database for authentication:

### Customer Profile A (Primary Demo Profile)
- **Email**: `john@example.com`
- **Password**: `johnpassword123`
- **User Profile**: John Doe (Owns the double-charge transaction and Webcam purchase history)

### Customer Profile B
- **Email**: `jane@example.com`
- **Password**: `janepassword123`
- **User Profile**: Jane Smith

---

## 3. Razorpay Test Credentials & Simulation Card Info

To test checkout payments via the Razorpay popup:

### Gateway API Credentials
- **Razorpay Key ID**: `rzp_test_TNAbrqeGTrHVaW`
- **Razorpay Key Secret**: `7Dpim3mU0N13n3pbtgVtqpKu`

### Test Card Details
Use any of the following values inside the Razorpay Checkout overlay:

| Card Number | Expiry Date | CVV | Otp | Result |
| :--- | :--- | :--- | :--- | :--- |
| `4111 1111 1111 1111` | Any future date (e.g. `12/30`) | `123` | `123456` | **SUCCESS** (Generates active payment record) |
| `4111 1111 1111 1112` | Any future date | `123` | *Choose Fail OTP* | **FAILED** (Rejected card simulation) |
