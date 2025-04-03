// process-payment.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-08-16',
  timeout: 10000
});

exports.handler = async (event) => {
  // 1. Validate HTTP method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // 2. Parse and validate request
    const { paymentMethodId, amount, email, name, plan } = JSON.parse(event.body);
    
    // Validate required fields
    const requiredFields = ['paymentMethodId', 'amount', 'email', 'name', 'plan'];
    const missingFields = requiredFields.filter(field => !event.body[field]);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          missingFields
        })
      };
    }

    // 3. Create or retrieve customer
    let customer;
    try {
      // Check if customer exists
      const existingCustomers = await stripe.customers.list({ email });
      customer = existingCustomers.data[0];
      
      if (!customer) {
        customer = await stripe.customers.create({
          email,
          name,
          payment_method: paymentMethodId,
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      } else {
        // Attach new payment method to existing customer
        await stripe.paymentMethods.attach(paymentMethodId, {
          customer: customer.id
        });
        
        // Set as default payment method
        await stripe.customers.update(customer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId
          }
        });
      }
    } catch (customerError) {
      console.error('Customer Error:', customerError);
      throw new Error('Failed to setup customer account');
    }

    // 4. Create subscription
    const priceId = plan === 'standard' 
      ? process.env.STANDARD_PRICE_ID 
      : process.env.PREMIUM_PRICE_ID;

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    });

    // 5. Send confirmation email (simplified example)
    try {
      // In production, use a proper email service
      console.log('Would send email to:', email, 'for subscription:', subscription.id);
    } catch (emailError) {
      console.error('Email Error:', emailError);
      // Continue even if email fails
    }

    // 6. Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        paymentIntent: subscription.latest_invoice.payment_intent,
        customerId: customer.id,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status
      })
    };

  } catch (error) {
    console.error('Payment Error:', error);
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.message || 'Payment processing failed',
        type: error.type,
        code: error.code,
        detail: error.raw?.message
      })
    };
  }
};