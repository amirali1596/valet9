const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const mailer = require('nodemailer');

exports.handler = async (event) => {
  const { customerId, reason } = JSON.parse(event.body);
  
  try {
    // 1. Cancel subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      throw new Error('No active subscription found');
    }

    const cancelledSub = await stripe.subscriptions.cancel(
      subscriptions.data[0].id
    );

    // 2. Send confirmation email
    const customer = await stripe.customers.retrieve(customerId);
    const transporter = mailer.createTransport({
      service: 'Gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      to: customer.email,
      subject: 'Your Valet Waste Service Has Been Cancelled',
      html: `<p>We're sorry to see you go. Your service has been cancelled.</p>
             ${reason ? `<p>Reason: ${reason}</p>` : ''}`
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        cancellation_date: new Date().toISOString()
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};