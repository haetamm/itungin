import { Helmet } from 'react-helmet-async';

import '../styles/pages/not-found.scss';

export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Not Found | 404</title>
        <meta name='description' content='Not Found page 404' />
      </Helmet>
      <div id="app" className="bg-white font-gabarito">
        <div>404</div>
        <div className="txt">
          Not Found<span className="blink">_</span>
        </div>
      </div>
    </>
  )
}
