import Stripe from 'stripe';
import { getSystemConfig } from "@/lib/config-helper";

export const getStripe = async () => {
  const key = await getSystemConfig("STRIPE_SECRET_KEY");
  if (!key) {
    throw new Error("Stripe Secret Key is not configured in system_config");
  }
  
  return new Stripe(key, {
    apiVersion: '2025-12-15.clover',
    typescript: true,
  });
}
