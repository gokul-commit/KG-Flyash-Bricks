import "../styles.css";

export default function Layout({ children }) {
  return (
    <div className="app">
      <header className="header">KG FlyAsh Bricks Management</header>

      <div className="body">
        <aside className="sidebar">
          <p>Dashboard</p>
          <p>Products</p>
          <p>Editor</p>
        </aside>

        <main className="content">
          {children}
        </main>
      </div>
    </div>
  );
}
