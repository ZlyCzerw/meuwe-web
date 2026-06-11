import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LandingNav } from '../components/landing/LandingNav'
import { LandingFooter } from '../components/landing/sections/LandingFooter'
import { renderArticle } from '../lib/renderArticle'
import { supabase } from '../lib/supabase'
import { C, F } from '../lib/tokens'

interface BlogPost {
  id: string
  title: string
  image: string | null
  article: string
  name: string | null
  date: string
  category: string
  lang: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

export default function Blog() {
  const { t } = useTranslation()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const articleRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    document.body.style.overflow = 'auto'
    document.documentElement.style.overflow = 'auto'
    return () => {
      document.body.style.overflow = ''
      document.documentElement.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    ;(supabase as any)
      .from('meuwe_blog')
      .select('id,title,image,article,name,date,category,lang')
      .order('date', { ascending: false })
      .then(({ data }: { data: BlogPost[] | null }) => {
        setPosts(data ?? [])
        setLoading(false)
      })
  }, [])

  // Scroll-spy via IntersectionObserver
  useEffect(() => {
    if (posts.length === 0) return
    const obs = new IntersectionObserver(
      entries => {
        entries.forEach(e => {
          if (e.isIntersecting) setActiveId(e.target.id)
        })
      },
      { rootMargin: '-20% 0px -60% 0px' },
    )
    Object.values(articleRefs.current).forEach(el => {
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [posts])

  // JSON-LD BlogPosting schema per post
  useEffect(() => {
    posts.forEach(post => {
      const scriptId = `jsonld-${post.id}`
      if (document.getElementById(scriptId)) return
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.text = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        headline: post.title,
        datePublished: post.date,
        author: { '@type': 'Person', name: post.name ?? 'meuwe' },
        url: `https://meuwe.eu/blog#${post.id}`,
        ...(post.image ? { image: post.image } : {}),
      })
      document.head.appendChild(script)
    })
  }, [posts])

  return (
    <div style={{ background: C.cream, minHeight: '100dvh' }}>
      <LandingNav />

      {/* Page header */}
      <div
        style={{
          paddingTop: 80,
          paddingBottom: 40,
          paddingLeft: 24,
          paddingRight: 24,
          background: '#fff',
          borderBottom: `2px solid ${C.ink}22`,
        }}
      >
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <span
            style={{
              fontFamily: F.body,
              fontSize: 13,
              fontWeight: 700,
              color: C.primary,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {t('blog.articles')}
          </span>
          <h1
            style={{
              fontFamily: F.display,
              fontSize: 48,
              fontWeight: 900,
              color: C.ink,
              margin: '8px 0 12px',
            }}
          >
            {t('blog.title')}
          </h1>
          <p style={{ fontFamily: F.body, fontSize: 18, color: C.inkSoft, margin: 0 }}>
            {t('blog.subtitle')}
          </p>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '40px 24px',
          display: 'flex',
          gap: 48,
          alignItems: 'flex-start',
        }}
      >
        {/* Sticky sidebar TOC */}
        {posts.length > 0 && (
          <aside
            style={{
              flexShrink: 0,
              width: 200,
              position: 'sticky',
              top: 80,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            <p
              style={{
                fontFamily: F.body,
                fontSize: 12,
                fontWeight: 800,
                color: C.inkSoft,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 8,
                marginTop: 0,
              }}
            >
              {t('blog.articles')}
            </p>
            {posts.map(post => (
              <button
                key={post.id}
                onClick={() =>
                  document.getElementById(post.id)?.scrollIntoView({ behavior: 'smooth' })
                }
                style={{
                  fontFamily: F.body,
                  fontSize: 14,
                  fontWeight: activeId === post.id ? 800 : 500,
                  color: activeId === post.id ? C.primary : C.inkSoft,
                  background: 'none',
                  border: 'none',
                  borderLeft: `3px solid ${activeId === post.id ? C.primary : 'transparent'}`,
                  paddingLeft: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                  textAlign: 'left',
                  cursor: 'pointer',
                  lineHeight: 1.4,
                }}
              >
                {post.title}
              </button>
            ))}
          </aside>
        )}

        {/* Articles */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {loading && (
            <p style={{ fontFamily: F.body, color: C.inkSoft }}>{t('blog.loading')}</p>
          )}
          {!loading && posts.length === 0 && (
            <div
              style={{
                background: '#fff',
                border: `2.5px solid ${C.ink}`,
                borderRadius: 24,
                boxShadow: `4px 4px 0 ${C.ink}`,
                padding: 40,
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  fontFamily: F.display,
                  fontSize: 24,
                  fontWeight: 800,
                  color: C.ink,
                  marginBottom: 8,
                  marginTop: 0,
                }}
              >
                {t('blog.noPostsYet')}
              </p>
              <p style={{ fontFamily: F.body, color: C.inkSoft, margin: 0 }}>
                {t('blog.noPostsSoon')}
              </p>
            </div>
          )}
          {posts.map((post, i) => (
            <article
              key={post.id}
              id={post.id}
              ref={el => {
                articleRefs.current[post.id] = el
              }}
              style={{
                background: '#fff',
                border: `2.5px solid ${C.ink}`,
                borderRadius: 24,
                boxShadow: `4px 4px 0 ${C.ink}`,
                padding: '32px',
                marginBottom: i < posts.length - 1 ? 40 : 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 16,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontFamily: F.body, fontSize: 13, color: C.inkSoft }}>
                  {formatDate(post.date)}
                </span>
                {post.name && (
                  <span style={{ fontFamily: F.body, fontSize: 13, color: C.inkSoft }}>
                    · {t('blog.by')} {post.name}
                  </span>
                )}
                <span
                  style={{
                    fontFamily: F.body,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: C.primary,
                    background: `${C.primary}18`,
                    borderRadius: 999,
                    padding: '2px 10px',
                  }}
                >
                  {post.category}
                </span>
              </div>
              <h2
                style={{
                  fontFamily: F.display,
                  fontSize: 28,
                  fontWeight: 900,
                  color: C.ink,
                  marginBottom: 20,
                  marginTop: 0,
                }}
              >
                {post.title}
              </h2>
              {post.image && (
                <img
                  src={post.image}
                  alt={post.title}
                  style={{
                    width: '100%',
                    borderRadius: 16,
                    border: `2px solid ${C.ink}22`,
                    marginBottom: 24,
                    objectFit: 'cover',
                    maxHeight: 400,
                    display: 'block',
                  }}
                />
              )}
              <div>{renderArticle(post.article)}</div>
            </article>
          ))}
        </div>
      </div>

      <LandingFooter />
    </div>
  )
}
