import React, { useState, useEffect } from 'react';
import './App.css';

const AUTH_API = import.meta.env.VITE_AUTH_API;
const BOOKS_API = import.meta.env.VITE_BOOKS_API;
const REVIEWS_API = import.meta.env.VITE_REVIEWS_API;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  
  const [books, setBooks] = useState([]);
  const [newBook, setNewBook] = useState({ title: '', author: '' });
  
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({ book_id: '', content: '', rating: 5 });

  useEffect(() => {
    if (token) {
      fetchBooks();
      fetchReviews();
    }
  }, [token]);

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${AUTH_API}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        alert('Registrasi berhasil! Silakan login.');
        setIsRegistering(false);
        setUsername('');
        setPassword('');
      } else {
        alert('Registrasi gagal. Username mungkin sudah digunakan.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${AUTH_API}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        setToken(data.token);
        localStorage.setItem('token', data.token);
      } else {
        alert('Login gagal. Kredensial tidak valid.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    setToken('');
    localStorage.removeItem('token');
    setBooks([]);
    setReviews([]);
  };

  const fetchBooks = async () => {
    try {
      const res = await fetch(`${BOOKS_API}/books`);
      const data = await res.json();
      setBooks(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${BOOKS_API}/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBook)
      });
      setNewBook({ title: '', author: '' });
      fetchBooks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBook = async (id) => {
    try {
      await fetch(`${BOOKS_API}/books/${id}`, {
        method: 'DELETE'
      });
      fetchBooks();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${REVIEWS_API}/reviews/`);
      const data = await res.json();
      setReviews(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddReview = async (e, bookId) => {
    e.preventDefault();
    try {
      await fetch(`${REVIEWS_API}/reviews/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newReview, book_id: bookId })
      });
      setNewReview({ book_id: '', content: '', rating: 5 });
      fetchReviews();
    } catch (err) {
      console.error(err);
    }
  };

  if (!token) {
    return (
      <div className="login-container">
        <form className="login-form" onSubmit={isRegistering ? handleRegister : handleLogin}>
          <h1 className="logo text-center">BooksLib</h1>
          <h2 className="text-center">{isRegistering ? 'Registrasi' : 'Login'}</h2>
          <input 
            type="text" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
          />
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          <button type="submit" className="btn-primary">
            {isRegistering ? 'Daftar' : 'Masuk'}
          </button>
          <div className="text-center mt-10">
            <span style={{ fontSize: '0.9rem' }}>
              {isRegistering ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            </span>
            <button 
              type="button" 
              className="btn-link" 
              onClick={() => {
                setIsRegistering(!isRegistering);
                setUsername('');
                setPassword('');
              }}
            >
              {isRegistering ? 'Login di sini' : 'Daftar di sini'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header className="header flex-between">
        <h1 className="logo">BooksLib</h1>
        <button onClick={handleLogout} className="btn-outline">Logout</button>
      </header>

      <main className="content">
        <section className="section-box">
          <h2 className="section-title">Tambah Buku Baru</h2>
          <form className="flex-form" onSubmit={handleAddBook}>
            <input 
              type="text" 
              placeholder="Judul Buku" 
              value={newBook.title}
              onChange={e => setNewBook({...newBook, title: e.target.value})}
              required
            />
            <input 
              type="text" 
              placeholder="Penulis" 
              value={newBook.author}
              onChange={e => setNewBook({...newBook, author: e.target.value})}
              required
            />
            <button type="submit" className="btn-primary">Simpan</button>
          </form>
        </section>

        <section className="books-list-section">
          <h2 className="section-title">Katalog Buku</h2>
          <ul className="books-list">
            {books.map((book) => (
              <li key={book.id} className="book-item">
                <div className="flex-between">
                  <div>
                    <span className="book-title">{book.title}</span>
                    <span className="book-author">Oleh: {book.author}</span>
                  </div>
                  <button onClick={() => handleDeleteBook(book.id)} className="btn-danger">Hapus</button>
                </div>
                
                <div className="reviews-section">
                  <h4 className="reviews-title">Ulasan:</h4>
                  <ul className="reviews-list">
                    {reviews.filter(r => r.book_id === book.id).map(review => (
                      <li key={review.id} className="review-item">
                        <strong>⭐ {review.rating}/5</strong> - {review.content}
                      </li>
                    ))}
                  </ul>
                  
                  <form className="flex-form mt-10" onSubmit={(e) => handleAddReview(e, book.id)}>
                    <input 
                      type="text" 
                      placeholder="Tulis ulasan..." 
                      value={newReview.book_id === book.id ? newReview.content : ''}
                      onChange={e => setNewReview({ book_id: book.id, content: e.target.value, rating: newReview.rating })}
                      required
                    />
                    <select 
                      value={newReview.book_id === book.id ? newReview.rating : 5}
                      onChange={e => setNewReview({ ...newReview, rating: parseInt(e.target.value) })}
                    >
                      {[1,2,3,4,5].map(num => <option key={num} value={num}>{num}</option>)}
                    </select>
                    <button type="submit" className="btn-outline">Kirim</button>
                  </form>
                </div>
              </li>
            ))}
            {books.length === 0 && (
              <li className="book-item text-center">Belum ada buku tersedia.</li>
            )}
          </ul>
        </section>
      </main>
    </div>
  );
}