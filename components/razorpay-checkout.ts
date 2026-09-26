"use client";

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

/**
 * Runs the whole purchase for one item. Resolves true once the payment is
 * verified server-side and access is granted; false/throws otherwise.
 */
export async function purchaseItem(itemType: "course" | "question_set", itemId: string): Promise<boolean> {
  const orderRes = await fetch("/api/v1/payments/order", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ itemType, itemId }),
  });
  const orderJson = await orderRes.json();
  if (!orderRes.ok) throw new Error(orderJson.error?.message || "Could not start checkout.");

  // Free / already owned — server granted access directly.
  if (orderJson.data?.granted) return true;

  const { orderId, amount, currency, keyId, title } = orderJson.data as {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    title: string;
  };

  const ready = await loadScript();
  if (!ready || !window.Razorpay) throw new Error("Could not load the payment window. Check your connection.");

  return new Promise<boolean>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: keyId,
      amount,
      currency,
      name: "Aperio",
      description: title,
      order_id: orderId,
      theme: { color: "#4f46e5" },
      handler: async (resp: RzpResponse) => {
        try {
          const verifyRes = await fetch("/api/v1/payments/verify", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              orderId: resp.razorpay_order_id,
              paymentId: resp.razorpay_payment_id,
              signature: resp.razorpay_signature,
            }),
          });
          const verifyJson = await verifyRes.json();
          if (!verifyRes.ok) throw new Error(verifyJson.error?.message || "Payment verification failed.");
          resolve(true);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Payment verification failed."));
        }
      },
      modal: { ondismiss: () => resolve(false) },
    });
    rzp.open();
  });
}
