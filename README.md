# Confera

Confera is a student-first IEEE India conference explorer built for fast shortlisting. It helps students search conferences, compare formats, filter by field and deadlines, and now records real usage with Convex analytics.

Live site: https://confera-production.up.railway.app
Repository: https://github.com/StarkAg/confera

## Stack

- React 19
- Vite 8
- Tailwind CSS 4
- Convex for usage analytics
- Railway for frontend hosting

## Features

- Browse IEEE India conference data from local markdown
- Search by conference, acronym, field, location, or sponsor
- Filter by CFP status, conference year, and research field
- View SRM-friendly tags and deadline-first sorting
- Track page views, searches, filter usage, and outbound IEEE clicks

## Local Development

```bash
npm install
npm run dev
```

## Production Build

```bash
npm run build
```

## Analytics

Convex stores:

- unique sessions
- page views
- searches
- filter changes
- clear-filter actions
- outbound IEEE link clicks

To inspect production analytics:

```bash
npx convex run analytics:overview --prod
```
