import Link from 'next/link';
import {
  Aperture,
  Play,
  Files,
  ChartNoAxesCombined,
  SlidersHorizontal,
  Check,
  PanelsTopLeft,
} from 'lucide-react';
import { Brand } from '@/components/studio/Brand';
import { Preview } from '@/components/studio/Preview';
export default function HomePage() {
  return (
    <div className="landing">
      <header className="marketingnav">
        <div className="wrap">
          <Brand />
          <nav aria-label="Product navigation">
            <a href="#features">Features</a>
            <a href="#forecast">How it works</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className="actions">
            <Link className="loginlink" href="/login">
              Log in
            </Link>
            <Link className="button small" href="/signup">
              Get started
            </Link>
          </div>
        </div>
      </header>
      <main>
        <section className="hero wrap">
          <div className="herocopy">
            <div className="audience">
              <Aperture size={15} />
              For photography studios
            </div>
            <h1>
              Know your cash <em>before your clients pay.</em>
            </h1>
            <p>
              Keep invoices, client promises and upcoming bills in one place.
              See what your studio can spend today and when cash might run
              short.
            </p>
            <div className="actions">
              <Link className="button" href="/signup">
                Start managing cash
              </Link>
              <form action="/demo" method="post">
                <button className="button secondary">
                  <Play size={15} />
                  Explore live demo
                </button>
              </form>
            </div>
          </div>
          <Preview />
        </section>
        <section className="benefits" id="features">
          <div className="wrap">
            <div className="sectionhead">
              <span className="overline">Studio finances</span>
              <h2>A clearer view of every rupee.</h2>
            </div>
            <div className="featuregrid">
              {[
                {
                  icon: Files,
                  title: 'Know who owes you',
                  text: 'Track advances, partial payments and overdue balances against the original invoice.',
                },
                {
                  icon: ChartNoAxesCombined,
                  title: 'See the weeks ahead',
                  text: 'Follow your daily cash balance across 30, 60 or 90 days, with an explanation for each receipt.',
                },
                {
                  icon: SlidersHorizontal,
                  title: 'Test a late payment',
                  text: 'Move a receipt or change a bill to see which obligations would leave your studio short.',
                },
              ].map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span className="featureicon">
                    <Icon size={23} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="forecast" className="wrap explain">
          <div>
            <span className="overline">Forecast methodology</span>
            <h2>From booked work to available cash.</h2>
          </div>
          <div>
            {[
              'Start with your opening balance and add recorded receipts, less paid bills.',
              'Project dated unpaid receipts and scheduled bills, one day at a time.',
              'Review missed promises and disputed invoices separately before including them.',
            ].map((t) => (
              <p key={t}>
                <Check size={18} />
                {t}
              </p>
            ))}
            <form action="/demo" method="post">
              <button className="textbtn">
                <PanelsTopLeft size={16} />
                Explore Sample Studio
              </button>
            </form>
          </div>
        </section>
        <section id="pricing" className="pricing">
          <div className="wrap">
            <span className="overline">Proposed pricing</span>
            <h2>Plans for creative businesses.</h2>
            <div className="featuregrid">
              {[
                ['Starter', '₹299', 'Solo photographers'],
                ['Studio', '₹799', 'Small photography studios'],
                ['Partner', 'Custom', 'Creative teams and partners'],
              ].map(([p, price, who]) => (
                <article key={p}>
                  <h3>{p}</h3>
                  <b>{price}</b>
                  {price !== 'Custom' && <small> / month</small>}
                  <p>{who}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <footer className="wrap">
        <Brand />
        <span>Cash planning for independent studios · INR · Asia/Kolkata</span>
      </footer>
    </div>
  );
}
