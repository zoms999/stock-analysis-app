# Project Introduction

This project is a comprehensive platform for analyzing stock data, managing user subscriptions, and providing various financial tools. It integrates with external APIs like Finnhub, Upbit, and Yahoo for real-time and historical stock information. The platform also includes features for user authentication, point systems, and administrative functionalities.

## Core Features

*   **Stock Data Analysis:** Access to real-time and historical candle data from multiple sources.
*   **User Management:** Secure authentication, user profiles, and subscription management.
*   **Point System:** A system to reward user activity and engagement.
*   **Content Management:** Features for posts and notices.
*   **Admin Tools:** Functionalities for managing prices and other administrative tasks.

---

# Webhook Usage Guide

Webhooks are automated messages sent from apps when something happens. They're used to connect different applications and automate workflows. In this project, webhooks are primarily used for handling events from third-party services, such as payment gateway notifications.

## Stripe Webhooks

Stripe webhooks are crucial for managing subscriptions and payments. They notify our system about events like successful payments, failed payments, subscription changes, and more.

### Local Testing with Webhooks

Testing webhooks locally can be challenging because external services like Stripe cannot directly reach your local development environment. To overcome this, we use tools that expose your local server to the internet.

#### Recommended Tool: `stripe listen` (Stripe CLI)

The Stripe CLI provides a convenient way to test webhooks locally. It forwards webhook events from your Stripe account to your local machine.

**1. Install the Stripe CLI:**

If you haven't already, install the Stripe CLI. You can find instructions on the official Stripe documentation: [Stripe CLI Installation](https://stripe.com/docs/stripe-cli#install)

**2. Login to Stripe CLI:**

```bash
stripe login
```

This will open your browser to authenticate the CLI with your Stripe account.

**3. Start Listening for Webhooks:**

Navigate to your project's root directory in the terminal and run the following command:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

*   Replace `localhost:3000` with the address where your local development server is running.
*   The path `/api/stripe/webhook` is the endpoint in your application that handles Stripe webhook events.

Upon successful execution, the Stripe CLI will provide you with a webhook secret. You'll need to configure this secret in your environment variables (e.g., `STRIPE_WEBHOOK_SECRET`) for your application to verify the authenticity of incoming webhook events.

**4. Triggering Webhook Events:**

Once `stripe listen` is running, you can trigger events from your Stripe dashboard (e.g., create a test payment, change a subscription status) or use the Stripe CLI to simulate events:

```bash
stripe trigger payment_intent.succeeded
```

This will send a `payment_intent.succeeded` event to your local webhook endpoint.

## General Webhook Best Practices

*   **Security:** Always verify the authenticity of incoming webhook requests using signatures or secrets provided by the sending service. This prevents unauthorized requests from being processed.
*   **Idempotency:** Design your webhook handlers to be idempotent. This means that processing the same event multiple times should have the same effect as processing it once. Webhooks can sometimes be delivered multiple times.
*   **Asynchronous Processing:** For long-running tasks, process webhook events asynchronously (e.g., using a job queue). This prevents timeouts and ensures that the webhook sender receives a timely response.
*   **Error Handling and Retries:** Implement robust error handling and logging. Most webhook services have a retry mechanism, so ensure your application can handle retried events.
*   **HTTPS:** Always use HTTPS for your webhook endpoints to ensure secure communication.