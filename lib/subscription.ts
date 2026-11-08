// The single place that answers "does this user have paid access?".
//
// Purchases are not wired up yet: the paywall doesn't start a purchase and
// nothing reads RevenueCat entitlements, so there is no real answer to give.
// Until that exists this returns true, which leaves every paid feature open.
// When purchases work, replace the body with the real entitlement check
// (e.g. Purchases.getCustomerInfo() and the active entitlement); every gated
// feature already goes through this function, so nothing else has to change.
export async function hasPaidAccess(): Promise<boolean> {
  return true;
}
