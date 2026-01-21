import { Link } from "react-router-dom";
import { KEY_PART_SEARCH, SEARCH_MAGIC_WORD_LARGEST, SEARCH_MAGIC_WORD_RECENT } from "../lib/commons";
import { Centered } from "./components";
import { search2Cwd } from "./commons";

const searchExamples: string[] = [SEARCH_MAGIC_WORD_LARGEST, SEARCH_MAGIC_WORD_RECENT, "meta:url"];

export default function SearchForm({
  searchBaseDir,
  setCwd,
  setSearch,
}: {
  searchBaseDir: string;
  setCwd: (cwd: string) => void;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
}) {
  return <Centered>
    To search{searchBaseDir ? ` in "${searchBaseDir}" dir` : ""},
    enter a search term in the search bar and press Enter.
    <br />
    Some special search term syntaxes: &lt;md5&gt;, meta:&lt;name&gt;,  meta:&lt;name&gt;=&lt;value&gt;.
    <br />
    <p>Examples: {searchExamples.map((term, i) => <>
      {i > 0 && ", "}
      <Link key={i} to={"/" + (searchBaseDir ? searchBaseDir + "/" : "") + KEY_PART_SEARCH + "/" + term} onClick={e => {
        e.preventDefault();
        setSearch(term);
        setCwd(search2Cwd(term, { baseDir: searchBaseDir }));
      }}>{term}</Link>
    </>)}
    </p>
  </Centered>
}
