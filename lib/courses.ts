export type Course = {
  id: string;
  title: string;
  description: string;
};

export const courses: Course[] = [
  {
    id: "programming-fundamentals",
    title: "Programming Fundamentals",
    description: "C syntax, control flow, arrays, pointers, and functions.",
  },
  {
    id: "data-structures",
    title: "Data Structures",
    description: "Lists, stacks, queues, trees, graphs, and complexity.",
  },
  {
    id: "object-oriented-programming",
    title: "Object-Oriented Programming",
    description: "Classes, inheritance, polymorphism, and design basics.",
  },
  {
    id: "database-systems",
    title: "Database Systems",
    description: "ER models, SQL, normalization, transactions, and indexes.",
  },
  {
    id: "operating-systems",
    title: "Operating Systems",
    description: "Processes, threads, scheduling, memory, and file systems.",
  },
  {
    id: "computer-networks",
    title: "Computer Networks",
    description: "Layers, routing, TCP/IP, DNS, HTTP, and network security.",
  },
  {
    id: "web-development",
    title: "Web Development",
    description: "HTML, CSS, JavaScript, APIs, and full-stack patterns.",
  },
  {
    id: "software-engineering",
    title: "Software Engineering",
    description: "Requirements, modeling, testing, maintenance, and teams.",
  },
  {
    id: "artificial-intelligence",
    title: "Artificial Intelligence",
    description: "Search, agents, knowledge, learning, and reasoning.",
  },
  {
    id: "numerical-methods",
    title: "Numerical Methods",
    description: "Approximation, roots, interpolation, and numerical error.",
  },
  {
    id: "probability-statistics",
    title: "Probability & Statistics",
    description: "Distributions, estimation, tests, regression, and sampling.",
  },
  {
    id: "discrete-mathematics",
    title: "Discrete Mathematics",
    description: "Logic, sets, relations, combinatorics, and proofs.",
  },
  {
    id: "computer-organization",
    title: "Computer Organization",
    description: "Data representation, logic, CPU, memory, and assembly.",
  },
  {
    id: "research-methods",
    title: "Research Methods",
    description: "Study design, literature, academic writing, and reporting.",
  },
];

export function getCourse(id: string) {
  return courses.find((course) => course.id === id);
}
