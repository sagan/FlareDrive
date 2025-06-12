import { Centered } from "./components";

export default function SearchForm({ searchBaseDir }: { searchBaseDir: string }) {
  return <Centered>
    To search{searchBaseDir ? ` in "${searchBaseDir}" dir` : ""}, enter a search term in the search bar and press Enter.
  </Centered>
}
