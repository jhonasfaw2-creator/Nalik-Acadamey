// Type declarations for Chapa Inline.js (https://js.chapa.co/v1/inline.js).
// Mirrors the official configuration options documented at
// https://developer.chapa.co/integrations/inline-js
// (plus `tx_ref` / `mobile`, which the library accepts).

export {};

interface ChapaCheckoutOptions {
  /** Chapa PUBLIC key (CHAPUBK_TEST-… / CHAPUBK_LIVE-…). Required. */
  publicKey: string;
  /** Amount to charge. Required. */
  amount: string | number;
  currency?: string;
  /** Our unique transaction reference, correlated on the server. */
  tx_ref?: string;
  /** Optional phone number to prefill (9-digit local Ethiopian format). */
  mobile?: string;
  availablePaymentMethods?: string[];
  customizations?: {
    buttonText?: string;
    styles?: string;
    successMessage?: string;
  };
  /** URL Inline.js POSTs a lightweight success callback to. */
  callbackUrl?: string;
  /** URL the browser is sent to after a completed payment. */
  returnUrl?: string;
  showFlag?: boolean;
  showPaymentMethodsNames?: boolean;
  onSuccessfulPayment?: (response: unknown, reference: string) => void;
  onPaymentFailure?: (message: string) => void;
  onClose?: () => void;
}

interface ChapaCheckoutInstance {
  /** Renders the payment form into the given container id. */
  initialize(containerId?: string): void;
}

interface ChapaCheckoutConstructor {
  new (options: ChapaCheckoutOptions): ChapaCheckoutInstance;
}

declare global {
  interface Window {
    ChapaCheckout?: ChapaCheckoutConstructor;
  }
}
