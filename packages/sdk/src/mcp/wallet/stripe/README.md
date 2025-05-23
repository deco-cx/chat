# How to test Stripe locally?

1. Install stripe CLI. Ref: https://docs.stripe.com/stripe-cli

2. Start the webhook local thing forwarding to the correct API endpoint:

`stripe listen --forward-to localhost:3001/webhooks/stripe`

3. Make sure you have the otherwise optional environment variables:

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET (This one will be outputted by the CLI on the previous
  step)
- CURRENCY_API_KEY
- TESTING_CUSTOMER_ID (If you want to test Events for a specific customer)

4. You can now run the `/apps/api` application and start firing webhook events.

I have included sample events at `/apps/api/testing/stripe/fixtures`. You can
run them using `deno run test:stripe` at the `/apps/api` CWD. You should add
more if needed.
