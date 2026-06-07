import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'

export default function Dashboard() {
  const [quotebooks, setQuotebooks] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getQuotebooks()
      .then((data) => setQuotebooks(data.quotebooks))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="page-message">Loading quotebooks...</p>
  if (error) return <p className="error page-message">{error}</p>

  return (
    <div className="dashboard">
      <h2>Your quotebooks</h2>
      <div className="quotebooks-list">
        {quotebooks.map((book) => (
          <article key={book.id} className="quotebook-card">
            <h3>
              <Link to={`/quotebook/${book.id}`}>{book.title}</Link>
            </h3>
            <p>{book.description}</p>
            <span className="badge">Role: {book.user_role}</span>
          </article>
        ))}
      </div>
    </div>
  )
}
