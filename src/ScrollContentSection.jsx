// components/HeroOverlay.jsx
import React, { useRef, useEffect } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger,ScrollSmoother)
 




function ScrollContentSection () {
  return (
    <div>
      <section style={{ width: '100vw', height: '100vh' }}>
        <div className='flex items-end h-full'>
          <div className='py-4'>
            <h1 className='hero_text'>Limitless begins here</h1>
          </div>
        </div>
      </section>

         <section className='section'>
        <h1>test</h1>
      </section>


  <section className='section'>
        <h1>test</h1>
      </section>


  <section className='section'>
        <h1>test</h1>
      </section>

  <section className='section'>
        <h1>test</h1>
      </section>

  <section className='section'>
        <h1>test</h1>
      </section>

  <section className='section'>
        <h1>test</h1>
      </section>

  <section className='section'>
        <h1>test</h1>
      </section>

  <section className='section'>
        <h1>test</h1>
      </section>

 

    </div>
  )
}

export default ScrollContentSection
