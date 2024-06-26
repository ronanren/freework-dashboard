"use client"
import { useEffect, useState, useRef, useMemo } from 'react';
import { getJobs } from '@/api/getJobs';
import DataTable from 'react-data-table-component';
import moment from 'moment';
import 'moment/locale/fr';
import Loading from '@/assets/loading';
import Magnifier from '@/assets/magnifier';
import { AreaChart, DonutChart, BarChart } from '@tremor/react';
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/react"
import { getJobsCount } from '@/api/getJobsCount';
import dynamic from 'next/dynamic';
moment().locale('fr')

export default function Home() {
  const [allJobs, setAllJobs] = useState([]);
  const [keywords, setKeywords] = useState('');
  const [numberJobs, setNumberJobs] = useState(300);
  const inputRef = useRef(null);
  const [loading, setLoading] = useState(false);

  // statistics
  const [numberJobsPerDay, setNumberJobsPerDay] = useState([]);
  const [numberJobsPerTechno, setNumberJobsPerTechno] = useState([]);
  const [AverageTjmByLevel, setAverageTjmByLevel] = useState([]);

  // filter
  const [remote, setRemote] = useState(false);
  const [partiel, setPartiel] = useState(false);
  const [presentiel, setPresentiel] = useState(false);
  const [minTjm, setMinTjm] = useState(0);
  const [junior, setJunior] = useState(false);
  const [intermediate, setIntermediate] = useState(false);
  const [expert, setExpert] = useState(false);
  const [senior, setSenior] = useState(false);

  const Map = useMemo(() => dynamic(
    () => import('@/app/map'),
    {
      loading: () => <p>A map is loading</p>,
      ssr: false
    }
  ), [])

  const filterJobsByXp = (jobsData) => {
    const filteredJobs = jobsData.filter(job => {
      if ((!junior && !intermediate && !expert && !senior) ||
        (junior && job.experienceLevel === 'junior') ||
        (intermediate && job.experienceLevel === 'intermediate') ||
        (expert && job.experienceLevel === 'expert') ||
        (senior && job.experienceLevel === 'senior')) {
        return true;
      }
      return false;
    });
    return filteredJobs;
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = generateUrl(keywords);

      let list = [];
      const numberPerRequest = 300;
      for (let i = 0; i < numberJobs / numberPerRequest; i++) {
        list.push(numberPerRequest)
      }

      const promises = list.map((numberItem, index) => {
        const urlFetch = url + "&page=" + (parseInt(index) + 1) + "&itemsPerPage=" + numberItem;
        return getJobs(urlFetch);
      });
      const results = await Promise.all(promises);
      const jobsData = results.flat();
      setAllJobs(jobsData);
      setLoading(false);

      let dataGraph = []
      jobsData.forEach(job => {
        const date = moment(job.publishedAt).format('DD/MM/YYYY');
        const existingItem = dataGraph.find(item => item.date === date);

        if (existingItem) {
          existingItem['Nombre de missions'] += 1;
        } else {
          dataGraph.push({ date, 'Nombre de missions': 1 });
        }
      });
      dataGraph.sort((a, b) => moment(a.date, 'DD/MM/YYYY').diff(moment(b.date, 'DD/MM/YYYY')));
      setNumberJobsPerDay(dataGraph);

      let dataGraphTechno = []
      jobsData.forEach(job => {
        job.skills.forEach(skill => {
          const existingItem = dataGraphTechno.find(item => item.name === skill.name);

          if (existingItem) {
            existingItem['Nombre de missions'] += 1;
          } else {
            dataGraphTechno.push({ name: skill.name, 'Nombre de missions': 1 });
          }
        });
      });
      dataGraphTechno.sort((a, b) => b['Nombre de missions'] - a['Nombre de missions']);
      dataGraphTechno = dataGraphTechno.slice(0, 10);
      setNumberJobsPerTechno(dataGraphTechno);

      let dataGraphLevel = []
      jobsData.forEach(job => {
        const existingItem = dataGraphLevel.find(item => item.name === job.experienceLevel);
        let min = job.minDailySalary;
        let max = job.maxDailySalary;

        if (existingItem) {
          existingItem['Nombre de missions'] += 1;
          existingItem['min TJM moyen'] += min;
          existingItem['max TJM moyen'] += max;
          if (max !== null && min !== null) {
            existingItem['nbrTjm'] += 1;
          }
        } else {
          dataGraphLevel.push({ name: job.experienceLevel, 'Nombre de missions': 1, 'min TJM moyen': min, 'max TJM moyen': max, 'nbrTjm': max !== null && min !== null ? 1 : 0 });
        }
      });
      dataGraphLevel.forEach(item => {
        item['min TJM moyen'] = Math.round(item['min TJM moyen'] / item['nbrTjm']);
        item['max TJM moyen'] = Math.round(item['max TJM moyen'] / item['nbrTjm']);
      });
      const order = ['junior', 'intermediate', 'expert', 'senior'];

      const sortedData = dataGraphLevel.sort((a, b) => {
        const orderA = order.indexOf(a.name);
        const orderB = order.indexOf(b.name);
        return orderA - orderB;
      });
      setAverageTjmByLevel(sortedData);

    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
      fetchData();
    }
  };

  const generateUrl = (keywords) => {
    let url = "https://www.free-work.com/api/job_postings?contracts=contractor&order=date";
    if (keywords) {
      url += "&searchKeywords=" + keywords;
    }
    let remoteModes = [];
    if (remote) {
      remoteModes.push('full');
    }
    if (partiel) {
      remoteModes.push('partial');
    }
    if (presentiel) {
      remoteModes.push('none');
    }
    if (remoteModes.length > 0) {
      url += "&remoteMode=" + remoteModes.join(",");
    }
    if (minTjm) {
      url += "&minDailySalary=" + minTjm;
    }
    return url;
  }

  const handleChange = async (event) => {
    setKeywords(event.target.value);
    const url = generateUrl(event.target.value);
    const numberJobsToFetch = await getJobsCount(url);
    setNumberJobs(numberJobsToFetch);
  }

  useEffect(() => {
    const fetchData = async () => {
      const url = generateUrl(keywords);
      const numberJobsToFetch = await getJobsCount(url);
      setNumberJobs(numberJobsToFetch);
    };

    fetchData();
  }, [remote, partiel, presentiel, minTjm]);

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    {
      name: 'Publication',
      selector: row => row.publishedAt,
      format: row => "il y a " + moment.duration(moment().diff(moment(row.publishedAt))).humanize(),
      sortable: true,
      reorder: true,
      width: '120px',
    },
    {
      name: 'Titre',
      selector: row => row.title,
      reorder: true,
      width: '300px',
    },
    {
      name: 'TJM',
      selector: row => row.dailySalary,
      sortable: true,
      reorder: true,
      width: '110px',
    },
    {
      name: 'Remote',
      selector: row => row.remoteMode,
      format: row => row.remoteMode === 'full' ? 'Full' : row.remoteMode === 'partial' ? 'Partiel' : 'Non précisé',
      sortable: true,
      reorder: true,
      width: '120px',
    },
    {
      name: 'Durée',
      selector: row => row.duration,
      format: row => row.duration ? `${row.duration} mois` : 'Non précisé',
      sortable: true,
      reorder: true,
      width: '100px',
    },
    {
      name: 'Xp',
      selector: row => row.experienceLevel,
      sortable: true,
      reorder: true,
      width: '110px',
    },
    {
      name: 'Skills',
      selector: row => row.skills,
      format: row => row.skills.map(obj => obj.name).join(', '),
      sortable: true,
      reorder: true,
      width: '200px',
    },
    {
      name: 'Soft Skills',
      selector: row => row.softSkills,
      format: row => row.softSkills.map(obj => obj.name).join(', '),
      sortable: true,
      reorder: true,
      width: '150px',
    },
    {
      name: 'Entreprise',
      selector: row => row.company.name,
      sortable: true,
      reorder: true,
      width: '140px',
    },
    {
      name: 'Ville',
      selector: row => row.location.locality,
      sortable: true,
      reorder: true,
      width: '120px',
    },
  ];

  return (
    <main className="flex flex-col items-center justify-center w-full h-full p-5">
      <SpeedInsights />
      <Analytics />
      <h1 className="text-3xl md:text-4xl font-bold mt-1 mb-6 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 text-transparent bg-clip-text text-center">Dashboard Free-Work
      </h1>
      <div className="flex flex-row items-center justify-center">
        {loading ? <Loading className="w-8 h-8" /> : <Magnifier className="w-7 h-7 cursor-pointer" onClick={fetchData} />}
        <input
          ref={inputRef} type="text" placeholder="Entrer des mots-clés... Python, Javascript.."
          className="w-[80vw] md:w-96 max-w-96 px-4 py-2 ml-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 shadow-md"
          value={keywords}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

      </div>
      <p className='text-sm mt-2'>Nombre de missions : {numberJobs}</p>

      <div className="flex flex-col md:flex-row items-center mt-4 gap-4">
        <div className="flex items-center">
          <p className="text-sm font-bold">Télétravail :</p>
          <div className="flex items-center gap-1 ml-2">
            <input type="checkbox" id="remote" name="remote" value="remote" checked={remote} onChange={() => setRemote(!remote)} />
            <label htmlFor="remote">Remote</label>
            <input type="checkbox" id="partiel" name="partiel" value="partiel" checked={partiel} onChange={() => setPartiel(!partiel)} />
            <label htmlFor="partiel">Partiel</label>
            <input type="checkbox" id="présentiel" name="présentiel" value="présentiel" checked={presentiel} onChange={() => setPresentiel(!presentiel)} />
            <label htmlFor="présentiel">Présentiel</label>
          </div>
        </div>
        <div className="flex items-center">
          <p className="text-sm font-bold">TJM :</p>
          <div className="flex items-center gap-2 ml-2">
            <input type="text" id="minTjm" name="minTjm" placeholder="min" className="border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 shadow-md px-2 py-1 w-20" onChange={(e) => setMinTjm(e.target.value)} />
          </div>
        </div>
        <p className="text-sm font-bold">Xp :</p>
          <div className="flex items-center gap-1 ml-2">
            <input type="checkbox" id="junior" name="junior" value="junior" checked={junior} onChange={() => setJunior(!junior)} />
            <label htmlFor="junior">Junior</label>
            <input type="checkbox" id="intermediate" name="intermediate" value="intermediate" checked={intermediate} onChange={() => setIntermediate(!intermediate)} />
            <label htmlFor="intermediate">Intermediate</label>
            <input type="checkbox" id="senior" name="senior" value="senior" checked={senior} onChange={() => setSenior(!senior)} />
            <label htmlFor="senior">Senior</label>
            <input type="checkbox" id="expert" name="expert" value="expert" checked={expert} onChange={() => setExpert(!expert)} />
            <label htmlFor="expert">Expert</label>
          </div>
      </div>

      <div className="flex flex-col justify-center p-5 w-full">
        <h1 className="text-2xl mb-2 font-bold bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 text-transparent bg-clip-text">Offres de missions :</h1>
        <DataTable
          columns={columns}
          data={filterJobsByXp(allJobs)}
          progressPending={loading}
          progressComponent={<Loading className="w-20 h-[50.5vh]" />}
          noDataComponent={<h2 className="text-xl font-bold text-center">Aucune mission trouvée</h2>}
          pagination={true}
          fixedHeader={true}
          fixedHeaderScrollHeight="60vh"
          highlightOnHover={true}
          pointerOnHover={true}
          dense={true}
          onRowClicked={(row) => window.open("https://www.free-work.com/fr/tech-it/" + row.job.slug + "/job-mission/" + row.slug, '_blank')}
        />
        <div className="flex flex-col md:flex-row justify-center mt-4 gap-5">
          <div className="flex flex-col w-full">
            <h3 className="text-lg font-medium -mb-5">
              Nombre de missions par jour
            </h3>
            <AreaChart
              data={numberJobsPerDay}
              index="date"
              categories={['Nombre de missions']}
              colors={['blue']}
              yAxisWidth={60}
              showAnimation={true}
              className='py-5'
            />
          </div>
          <div className="flex flex-col w-full">
            <h3 className="text-lg font-medium">
              Répartition des technos demandées (top 10)
            </h3>
            <DonutChart
              data={numberJobsPerTechno}
              category="Nombre de missions"
              index="name"
              colors={['blue', 'sky', 'cyan', 'teal', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose']}
              className="w-full h-72 md:h-full p-4 md:p-10"
              showAnimation={true}
              label={numberJobsPerTechno[0] ? numberJobsPerTechno[0].name : ''}
            />
          </div>
        </div>

        <div className="flex flex-col md:flex-row justify-center mt-4 gap-5">
          <div className="flex flex-col w-full">
            <h3 className="text-lg font-medium -mb-5">
              Répartition des niveaux d'expérience par TJM moyen
            </h3>
            <BarChart
              className="mt-6"
              data={AverageTjmByLevel}
              index="name"
              categories={['min TJM moyen', 'max TJM moyen']}
              colors={['sky', 'blue']}
              yAxisWidth={30}
            />
          </div>
          <div className="flex flex-col w-full">
            <h3 className="text-lg font-medium -mb-5">
              Répartition des missions
            </h3>
            <div className="mt-8">
              <Map zoom={5} position={[46.603354, 1.888334]} width="100%" height="40vh" jobs={allJobs} />
            </div>
          </div>
        </div>
      </div>

      <footer className="flex flex-col items-center justify-end w-full mt-2">
        <p className="text-sm">Fait avec ❤️ par <a href="https://github.com/ronanren" target="_blank" rel="noopener noreferrer" className="text-blue-500">Ronanren</a></p>
      </footer>
    </main>
  );
}
