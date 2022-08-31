/* eslint-disable */
import axios from 'axios';
import { loadStripe } from '@stripe/stripe-js';

import { showAlert } from './alert';

const stripe = loadStripe(
  'pk_test_51LbnduJ1JjixMdSvIHkmOx28AUOBbho2ntxSOT4ErvQkPq7d2RhSpEgDjT6GSMyxzOcBBc8Df3Zzlrz91ncX7NWl00a0UKekXH'
);

export const bookTour = async (tourId) => {
  try {
    // Get checkout session from API
    const session = await axios(
      `http://127.0.0.1:3000/api/v1/bookings/checkout-session/${tourId}`
    );
    console.log(session);

    //create checkout form + charge credit card
    await stripe.redirectToCheckout({
      sessionId: session.data.session.id,
    });
  } catch (err) {
    console.log(err);
    showAlert('error', err);
  }
};
