const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const { customerId } = JSON.parse(event.body);
  
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1
    });

    if (subscriptions.data.length > 0) {
      const sub = subscriptions.data[0];
      return {
        statusCode: 200,
        body: JSON.stringify({
          active: true,
          plan: sub.items.data[0].plan.nickname,
          next_bill: new Date(sub.current_period_end * 1000).toLocaleDateString()
        })
      };
    }
    
    return { statusCode: 200, body: JSON.stringify({ active: false }) };
  } catch (error) {
    return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
  }
};