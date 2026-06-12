import QuoteLine from './QuoteLine'

export function BookHeading({ level, text }) {
  if (level === 1) return <h1 className="book-heading book-heading--1">{text}</h1>
  if (level === 2) return <h2 className="book-heading book-heading--2">{text}</h2>
  if (level === 3) return <h3 className="book-heading book-heading--3">{text}</h3>
  return <h4 className="book-heading book-heading--4">{text}</h4>
}

export function BookQuote({ quote }) {
  return (
    <article className="book-quote">
      {quote.lines?.map((line, index) => (
        <QuoteLine key={index} line={line} variant="book" />
      ))}
    </article>
  )
}

export function BookPageContent({ items }) {
  if (!items.length) {
    return <div className="book-page-body book-page-body--empty" aria-hidden="true" />
  }

  return (
    <div className="book-page-body">
      {items.map((item, index) => {
        if (item.type === 'heading') {
          return (
            <BookHeading
              key={`heading-${index}-${item.text}-${item.level}`}
              level={item.level}
              text={item.text}
            />
          )
        }

        return (
          <BookQuote
            key={`quote-${item.quote.id}-${index}`}
            quote={item.quote}
          />
        )
      })}
    </div>
  )
}
