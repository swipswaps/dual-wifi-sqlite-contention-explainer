import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const syntheticSeries = [
  { t: 0, ms: 1 }, { t: 1, ms: 2 }, { t: 2, ms: 4 }, { t: 3, ms: 19 },
  { t: 4, ms: 31 }, { t: 5, ms: 8 }, { t: 6, ms: 4 }, { t: 7, ms: 23 },
  { t: 8, ms: 6 }, { t: 9, ms: 2 }
];

export default function ContentionChart() {
  const ref = useRef(null);

  useEffect(() => {
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();

    const width = 640;
    const height = 220;
    const margin = { top: 12, right: 18, bottom: 34, left: 48 };
    const x = d3.scaleLinear().domain([0, 9]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 35]).range([height - margin.bottom, margin.top]);

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('role', 'img')
      .attr('aria-label', 'Illustrative lock and contention latency chart');

    svg
      .append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(9));

    svg
      .append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    svg
      .append('path')
      .datum(syntheticSeries)
      .attr('fill', 'none')
      .attr('stroke', '#70dfbd')
      .attr('stroke-width', 3)
      .attr('d', d3.line().x((d) => x(d.t)).y((d) => y(d.ms)));

    svg
      .selectAll('circle')
      .data(syntheticSeries)
      .join('circle')
      .attr('cx', (d) => x(d.t))
      .attr('cy', (d) => y(d.ms))
      .attr('r', 4)
      .attr('fill', '#f0bd72');

    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height - 4)
      .attr('fill', '#9aaac4')
      .attr('text-anchor', 'middle')
      .text('synthetic sample sequence (latency / lock wait ms)');
  }, []);

  return <svg className="chart" ref={ref} />;
}
