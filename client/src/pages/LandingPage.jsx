import { Link } from 'react-router-dom';
import './LandingPage.css';

const topLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Resources', href: '#resources' },
  { label: 'Bookings', href: '#bookings' },
  { label: 'Tickets', href: '#tickets' },
  { label: 'Contact', href: '#contact' },
];

const featurePills = [
  'EC Hall Booking',
  'Lecture Hall Reservations',
  'Lab & Equipment Requests',
  'Maintenance Ticket Tracking',
];

const resourceCards = [
  {
    title: 'EC Hall & Event Spaces',
    body: 'Book EC Hall and campus event areas with clear time slots and availability.',
  },
  {
    title: 'Lecture Halls & Classrooms',
    body: 'Reserve teaching spaces quickly for classes, sessions, and academic events.',
  },
  {
    title: 'Labs & Shared Equipment',
    body: 'Manage lab bookings and request projectors, displays, and shared devices.',
  },
  {
    title: 'Smart Availability View',
    body: 'Check resource status in one view to avoid conflicts and reduce delays.',
  },
];

const ticketSteps = [
  {
    title: 'Raise Ticket',
    body: 'Report campus issues in seconds with category, priority, and location details.',
  },
  {
    title: 'Track Progress',
    body: 'Follow updates from open to in-progress with comments and assignment visibility.',
  },
  {
    title: 'Confirm Resolution',
    body: 'See solved status and final notes so you know exactly when issues are fixed.',
  },
];

function Icon({ type }) {
  if (type === 'brand') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M12 3 3 7.6 12 12l9-4.4L12 3Z' />
        <path d='M5 10v6l7 3.5 7-3.5v-6' />
      </svg>
    );
  }
  if (type === 'arrow') {
    return (
      <svg viewBox='0 0 24 24' aria-hidden='true'>
        <path d='M5 12h14M13 6l6 6-6 6' />
      </svg>
    );
  }
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true'>
      <path d='M4 12h16M12 4v16' />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <div className='landing-page'>
      <header className='landing-nav'>
        <div className='landing-inner'>
          <div className='landing-brand'>
            <span className='brand-icon'>
              <Icon type='brand' />
            </span>
            <div>
              <strong>UniSphere</strong>
              <small>Smart Campus Platform</small>
            </div>
          </div>

          <nav className='landing-links' aria-label='Primary'>
            {topLinks.map((item) => (
              <a key={item.label} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className='landing-actions'>
            <Link className='btn btn-outline' to='/signup'>
              Create Account
            </Link>
            <Link className='btn btn-solid' to='/login'>
              Login / Portal
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className='hero' id='home'>
          <div className='landing-inner hero-grid'>
            <div className='hero-copy'>
              <span className='hero-chip'>Campus Booking & Ticketing</span>
              <h1>
                Book Resources.
                <span> Report Issues. Get Them Solved.</span>
              </h1>
              <p>
                UniSphere helps your campus manage EC Hall bookings, classroom scheduling,
                resource requests, and maintenance tickets from one clean portal.
              </p>

              <div className='hero-buttons'>
                <Link className='btn btn-solid' to='/bookings'>
                  Start Booking
                </Link>
                <Link className='btn btn-outline' to='/tickets'>
                  Open Ticket Center
                </Link>
              </div>
            </div>

            <div className='hero-media'>
              <img
                className='hero-photo'
                src='/images/landing-campus.png'
                alt='Modern smart campus building with students'
              />
              <div className='hero-photo-overlay' />
              <div className='hero-glow-ring' />

              <div className='hero-caption'>
                <p>UniSphere Live Board</p>
                <h3>Bookings + Tickets + Notifications</h3>
              </div>

              <div className='floating-tag floating-tag--one'>
                <span>Resolved Tickets</span>
                <strong>24 this week</strong>
              </div>

              <div className='floating-tag floating-tag--two'>
                <span>Booking Success Rate</span>
                <strong>96%</strong>
              </div>

              <div className='hero-status-row'>
                <article className='status-pill'>
                  <span>EC Hall</span>
                  <strong>Booked Today</strong>
                </article>
                <article className='status-pill'>
                  <span>Tickets</span>
                  <strong>7 In Progress</strong>
                </article>
                <article className='status-pill'>
                  <span>Solved</span>
                  <strong>24 This Week</strong>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section className='feature-strip' id='bookings'>
          <div className='landing-inner feature-grid'>
            {featurePills.map((item) => (
              <article key={item} className='feature-pill'>
                <h3>{item}</h3>
              </article>
            ))}
          </div>
        </section>

        <section className='resources' id='resources'>
          <div className='landing-inner'>
            <div className='section-head'>
              <h2>Resource Booking for Real Campus Needs</h2>
              <p>
                From EC Hall to labs, your teams can reserve what they need with faster approvals
                and better visibility.
              </p>
            </div>

            <div className='resource-grid'>
              {resourceCards.map((card) => (
                <article key={card.title} className='resource-card'>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <Link to='/bookings'>
                    Go to bookings
                    <Icon type='arrow' />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className='tickets' id='tickets'>
          <div className='landing-inner'>
            <div className='section-head'>
              <h2>Ticket Workflow That Solves Problems Faster</h2>
              <p>
                Create requests, track progress, and close issues with clear status updates.
              </p>
            </div>

            <div className='ticket-grid'>
              {ticketSteps.map((step, index) => (
                <article key={step.title} className='ticket-step'>
                  <span>{index + 1}</span>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className='cta'>
          <div className='landing-inner cta-wrap'>
            <div>
              <h2>Ready to Use UniSphere for Your Campus?</h2>
              <p>Access booking, resources, and ticket resolution from one platform.</p>
            </div>
            <div className='cta-actions'>
              <Link className='btn btn-solid' to='/login'>
                Login Now
              </Link>
              <Link className='btn btn-outline' to='/signup'>
                Register
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className='landing-footer' id='contact'>
        <div className='landing-inner footer-wrap'>
          <span>{new Date().getFullYear()} UniSphere Smart Campus</span>
          <span>Bookings, Resources, Tickets, Notifications</span>
        </div>
      </footer>
    </div>
  );
}
