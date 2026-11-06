'use client'

import React, { useState, useEffect } from 'react'
import { submitUserFeedback } from '@/lib/feedback'

interface FeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  defaultCityOrZip?: string
  defaultEmail?: string
  defaultWish?: string
  userId?: string | null
}

export default function FeedbackModal({
  isOpen,
  onClose,
  defaultCityOrZip = '',
  defaultEmail = '',
  defaultWish = '',
  userId = null,
}: FeedbackModalProps) {
  const [wish, setWish] = useState(defaultWish)
  const [email, setEmail] = useState(defaultEmail)
  const [cityOrZip, setCityOrZip] = useState(defaultCityOrZip)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (defaultWish) setWish(defaultWish)
      if (defaultCityOrZip) setCityOrZip(defaultCityOrZip)
      if (defaultEmail) setEmail(defaultEmail)
      setSubmitted(false)
      setErrorMsg('')
    }
  }, [isOpen, defaultWish, defaultCityOrZip, defaultEmail])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!wish.trim()) {
      setErrorMsg('Please tell us what drink or feature you wish SipScouts had!')
      return
    }

    setSubmitting(true)
    setErrorMsg('')

    try {
      const res = await submitUserFeedback({
        craving_or_feature_wish: wish.trim(),
        user_email: email.trim() || null,
        city_or_zip: cityOrZip.trim() || null,
        user_id: userId,
      })

      if (res.ok) {
        setSubmitted(true)
        setTimeout(() => {
          onClose()
          setWish('')
          setSubmitted(false)
        }, 2200)
      } else {
        setErrorMsg(res.error || 'Could not save feedback. Please try again.')
      }
    } catch {
      setErrorMsg('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(28, 12, 6, 0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass"
        style={{
          maxWidth: 460,
          width: '100%',
          padding: '1.65rem 1.5rem',
          background: 'rgba(252, 246, 240, 0.98)',
          borderRadius: 24,
          color: 'var(--text-main)',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
          border: '1.5px solid rgba(226, 114, 91, 0.35)',
        }}
      >
        {submitted ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.6rem' }}>🎉</div>
            <h3
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.4rem',
                color: 'var(--primary)',
                margin: '0 0 0.5rem',
              }}
            >
              Wish Logged!
            </h3>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: 'var(--text-light)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              Our scouting team has received your wish. We use every community request to expand local menus and build new scout features.
            </p>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.4rem' }}>💡</span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontFamily: 'Inter, sans-serif',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--primary)',
                    background: 'rgba(226, 114, 91, 0.12)',
                    padding: '0.2rem 0.55rem',
                    borderRadius: 99,
                  }}
                >
                  Community Wishlist
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  lineHeight: 1,
                  padding: '0.2rem',
                }}
              >
                &times;
              </button>
            </div>

            <h2
              id="feedback-modal-title"
              style={{
                fontFamily: 'Playfair Display, serif',
                fontSize: '1.35rem',
                lineHeight: 1.28,
                margin: '0 0 0.4rem',
                color: 'var(--text-main)',
              }}
            >
              What&apos;s one drink or feature you wish SipScouts had?
            </h2>

            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.82rem',
                color: 'var(--text-light)',
                margin: '0 0 1.1rem',
                lineHeight: 1.45,
              }}
            >
              Help us hunt down your favorite elusive cravings, or tell us what tool would make SipScouts your daily go-to.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label
                  htmlFor="feedback-wish-input"
                  style={{
                    display: 'block',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: 'var(--text-main)',
                    marginBottom: '0.35rem',
                  }}
                >
                  Your Drink or Feature Wish <span style={{ color: 'var(--primary)' }}>*</span>
                </label>
                <textarea
                  id="feedback-wish-input"
                  rows={3}
                  required
                  value={wish}
                  onChange={e => setWish(e.target.value)}
                  placeholder="e.g. Pistachio Cardamom Cold Brew, filter for late-night coffee shops, gluten-free bakery tags, or direct table reservation..."
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem',
                    borderRadius: 12,
                    border: '1.5px solid rgba(74, 46, 32, 0.22)',
                    background: '#ffffff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.88rem',
                    color: 'var(--text-main)',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem' }}>
                <div>
                  <label
                    htmlFor="feedback-city-input"
                    style={{
                      display: 'block',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: 'var(--text-light)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    City or ZIP (optional)
                  </label>
                  <input
                    id="feedback-city-input"
                    type="text"
                    value={cityOrZip}
                    onChange={e => setCityOrZip(e.target.value)}
                    placeholder="e.g. Norfolk, VA"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid rgba(74, 46, 32, 0.2)',
                      background: '#ffffff',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.82rem',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label
                    htmlFor="feedback-email-input"
                    style={{
                      display: 'block',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      color: 'var(--text-light)',
                      marginBottom: '0.25rem',
                    }}
                  >
                    Email for updates (optional)
                  </label>
                  <input
                    id="feedback-email-input"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@email.com"
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      borderRadius: 10,
                      border: '1px solid rgba(74, 46, 32, 0.2)',
                      background: '#ffffff',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: '0.82rem',
                      color: 'var(--text-main)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {errorMsg && (
                <p style={{ color: '#c0392b', fontSize: '0.78rem', margin: 0, fontFamily: 'Inter, sans-serif' }}>
                  {errorMsg}
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.4rem' }}>
                <button
                  type="submit"
                  disabled={submitting}
                  className="warm-btn"
                  style={{
                    flex: 1,
                    minBlockSize: 42,
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    cursor: submitting ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.4rem',
                  }}
                >
                  {submitting ? 'Submitting…' : '🚀 Send Scout Wish'}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="warm-btn-ghost"
                  style={{
                    minBlockSize: 42,
                    padding: '0 1rem',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    borderRadius: 12,
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
