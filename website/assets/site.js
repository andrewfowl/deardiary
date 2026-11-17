// Paste your Stripe Payment Links here. Until they are set, the buy buttons
// fall back to an email to support instead of a broken Stripe URL.
const CHECKOUT_LINKS = {
  lifetime: '',
  annual: ''
}

const SUPPORT_EMAIL = 'support@deardiary.app'

document.querySelectorAll('[data-checkout]').forEach((link) => {
  const plan = link.dataset.checkout
  const url = CHECKOUT_LINKS[plan]
  if (url) {
    link.href = url
    return
  }
  const subject = encodeURIComponent(`DearDiary ${plan} license`)
  link.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}`
})
