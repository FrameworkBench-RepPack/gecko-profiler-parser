# gecko-profiler-parser

A CLI tool for parsing and extracting relevant energy and bandwidth information from Gecko Profiler outputs.

## Setup

### 1. Clone the Repository

To clone the repository run the following git command:

```bash
git clone https://github.com/FrameworkBench-RepPack/gecko-profiler-parser.git
cd ./gecko-profiler-parser
```

### 2. Configure the Project

After cloning, install dependencies:

```bash
npm install
```

## Running the Parser

The project provides a single script:

```bash
npm run parse
```

To view available options and usage details, run:

```
$ npm run parse -- --help
> firefix-profiler-parser@1.0.0 parse
> tsx src/index.ts --help

Usage: Firefox Profiler Parser [options] <path>

A CLI tool for processing power measurements from the Firefox Profiler

Arguments:
  path                     Path to a profiler .json file or a folder containing multiple profiler .json files

Options:
  -V, --version            output the version number
  -t, --threads <entries>  specify number of workers to use (default: "1")
  --exportRaw              export power measurements in csv file (default: false)
  -h, --help               display help for command
```