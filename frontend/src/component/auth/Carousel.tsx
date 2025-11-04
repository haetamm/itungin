import React, { useEffect, useState } from 'react';
import carouselStyles from '../../styles/components/carousel.module.scss';

export default function Carousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const images = [
    `Cukup beberapa klik untuk migrasi data perusahaan Anda ke Jurnal!`,
    'Pastikan pelaporan keuangan perusahaan Anda sudah akurat dengan tutup buku',
    'Raih kesempatan untuk reward hingga Rp3 juta di program referral sekarang',
  ];

  const handleRadioChange = (index: React.SetStateAction<number>) => {
    setActiveIndex(index);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (activeIndex + 1) % images.length;
      setActiveIndex(nextIndex);
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [activeIndex, images.length]);

  return (
    <div
      className={`${carouselStyles.carousel}  mx-auto rounded-2xl p-0 lg:px-8`}
    >
      <div className={` ${carouselStyles.carouselInner}`}>
        {images.map((image, index) => (
          <React.Fragment key={index}>
            <input
              className={`${carouselStyles.carouselOpen} form-checkbox appearance-none hidden`}
              type="radio"
              id={`carousel${index + 1}`}
              name="carousel"
              aria-hidden="true"
              checked={index === activeIndex}
              onChange={() => handleRadioChange(index)}
            />
            <div
              className={` mx-auto justify-center mt-5 items-center ${carouselStyles.carouselItem}`}
            >
              <div
                key={index}
                className={`${carouselStyles.carouselImg} h-[150px] md:h-[180px] border-2 border-blue-300 px-5 items-center flex rounded-sm lg:rounded-2xl`}
              >
                <div className="flex justify-center text-md md:text-xl lg:text-2xl text-center items-center mx-auto">
                  {image}
                </div>
              </div>
            </div>
          </React.Fragment>
        ))}

        <ol className={carouselStyles.carouselIndicators}>
          {images.map((_, index) => (
            <li key={index}>
              <label
                htmlFor={`carousel${index + 1}`}
                className={`${carouselStyles.carouselBullet}} ${index === activeIndex ? 'active' : ''} hidden xs:inline-block`}
              >
                o
              </label>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
