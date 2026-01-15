import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Initialize Stripe
const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"), {
  apiVersion: "2022-11-15"
});
// Initialize Supabase Admin Client
const supabase = createClient(Deno.env.get("SUPABASE_URL"), // Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!  // use service role key
Deno.env.get("SERVICE_ROLE_KEY"));
serve(async (req)=>{
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event;
  try {
    // event = stripe.webhooks.constructEvent(body, sig!, webhookSecret);
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    console.log("🔥 Received Stripe event:", event.type); // <== ADD THIS LINE
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return new Response(`Webhook Error: ${err.message}`, {
      status: 400
    });
  }
  // Handle checkout.session.completed
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const auth_uid = session.client_reference_id; // the user ID you attached when creating Checkout Session
    const subscription = session.subscription; // Stripe subscription ID
    const customer = session.customer; // Stripe customer ID
    if (!auth_uid) {
      console.error('Missing client_reference_id.');
      return new Response('Missing user ID', {
        status: 400
      });
    }
    console.log(`Updating profile for user: ${auth_uid}`);
    // Update user's profile to Pro
    const { error } = await supabase.from('profiles').update({
      plan_type: 'pro',
      subscription_status: 'active',
      stripe_customer_id: customer,
      subscription_period_end: null // optional: you can later query the subscription for end date
    }).eq('auth_uid', auth_uid);
    if (error) {
      console.error('Error updating profile:', error.message);
      return new Response(`Supabase Update Error: ${error.message}`, {
        status: 500
      });
    }
    console.log('Profile updated successfully.');
  }
  return new Response(JSON.stringify({
    received: true
  }), {
    headers: {
      "Content-Type": "application/json"
    }
  });
});
