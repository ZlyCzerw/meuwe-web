import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { renderArticle, renderInline } from './renderArticle'

describe('renderArticle', () => {
  it('renders a paragraph', () => {
    render(<>{renderArticle('Hello world')}</>)
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('renders # as h3', () => {
    render(<>{renderArticle('# Big title')}</>)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Big title')
  })

  it('renders ## as h4', () => {
    render(<>{renderArticle('## Sub title')}</>)
    expect(screen.getByRole('heading', { level: 4 })).toHaveTextContent('Sub title')
  })

  it('renders ### as h5', () => {
    render(<>{renderArticle('### Minor title')}</>)
    expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('Minor title')
  })

  it('renders blank line as paragraph break', () => {
    render(<>{renderArticle('Para one\n\nPara two')}</>)
    expect(screen.getByText('Para one')).toBeInTheDocument()
    expect(screen.getByText('Para two')).toBeInTheDocument()
  })
})

describe('renderInline', () => {
  it('renders **bold** as strong', () => {
    render(<>{renderInline('say **hello** now')}</>)
    expect(screen.getByText('hello').tagName).toBe('STRONG')
  })

  it('renders *italic* as em', () => {
    render(<>{renderInline('say *italic* now')}</>)
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('renders [label](url) as anchor', () => {
    render(<>{renderInline('[meuwe](https://meuwe.eu)')}</>)
    const link = screen.getByRole('link', { name: 'meuwe' })
    expect(link).toHaveAttribute('href', 'https://meuwe.eu')
  })

  it('renders bare https URL as anchor', () => {
    render(<>{renderInline('visit https://meuwe.eu for more')}</>)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', 'https://meuwe.eu')
  })
})
