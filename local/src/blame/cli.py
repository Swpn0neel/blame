from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from . import __version__
from .core import BlameError, gather_contributors, sort_contributors

console = Console()
err_console = Console(stderr=True)


@click.command()
@click.argument("repo")
@click.option(
    "--merges/--no-merges",
    default=False,
    help="Include merge commits in the count. Default: excluded.",
)
@click.option(
    "-o",
    "--output",
    type=click.Path(dir_okay=False, path_type=Path),
    help="Write results to a file. Format is inferred from the extension (.csv or .json).",
)
@click.option(
    "--limit",
    type=click.IntRange(min=1),
    default=None,
    help="Only show the top N contributors.",
)
@click.option(
    "--sort-by",
    type=click.Choice(["commits", "name", "recent"]),
    default="commits",
    help="Sort order: most commits (default), name, or most recently active.",
)
@click.option(
    "--has-email",
    is_flag=True,
    default=False,
    help="Only show contributors with a real, public email address "
    "(drops anyone who only has a noreply.github.com address).",
)
@click.version_option(version=__version__, prog_name="blame")
def main(
    repo: str,
    merges: bool,
    output: Path | None,
    limit: int | None,
    sort_by: str,
    has_email: bool,
) -> None:
    """Extract contributor name/email/commit-count history from REPO.

    REPO can be a full URL (https://github.com/owner/name), an SSH URL,
    a bare github.com/owner/name path, or shorthand owner/name.
    """
    try:
        with console.status(f"[bold cyan]Cloning and analyzing {repo}..."):
            name, contributors = gather_contributors(repo, include_merges=merges)
    except BlameError as e:
        err_console.print(f"[bold red]Error:[/bold red] {e}")
        sys.exit(1)
    except KeyboardInterrupt:
        err_console.print("\n[yellow]Cancelled.[/yellow]")
        sys.exit(130)

    if not contributors:
        err_console.print("[yellow]No commits found.[/yellow]")
        sys.exit(0)

    if has_email:
        contributors = [c for c in contributors if c.email]
        if not contributors:
            err_console.print(
                "[yellow]No contributors with a public email address found.[/yellow]"
            )
            sys.exit(0)

    contributors = sort_contributors(contributors, sort_by)

    if limit is not None:
        contributors = contributors[:limit]

    total_commits = sum(c.commits for c in contributors)

    if output:
        _write_file(output, contributors)
        console.print(f"[green]Wrote {len(contributors)} contributors to {output}[/green]")
        return

    table = Table(title=f"Contributors - {name}", show_lines=False)
    table.add_column("#", justify="right", style="dim")
    table.add_column("Name", style="bold", overflow="fold")
    table.add_column("Username", style="cyan", overflow="fold")
    table.add_column("Email", style="magenta", overflow="fold")
    table.add_column("Commits", justify="right", style="green")
    table.add_column("First", style="dim")
    table.add_column("Last", style="dim")

    for i, c in enumerate(contributors, start=1):
        table.add_row(
            str(i),
            c.name,
            c.username or "-",
            c.email or "-",
            str(c.commits),
            c.first_commit,
            c.last_commit,
        )

    console.print(table)
    console.print(
        f"[dim]{len(contributors)} contributor(s), {total_commits} commit(s) total.[/dim]"
    )


def _write_file(path: Path, contributors) -> None:
    suffix = path.suffix.lower()
    rows = [
        {
            "name": c.name,
            "username": c.username,
            "email": c.email,
            "commits": c.commits,
            "first_commit": c.first_commit,
            "last_commit": c.last_commit,
        }
        for c in contributors
    ]
    if suffix == ".json":
        path.write_text(json.dumps(rows, indent=2), encoding="utf-8")
    elif suffix == ".csv" or suffix == "":
        if suffix == "":
            path = path.with_suffix(".csv")
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
            writer.writeheader()
            writer.writerows(rows)
    else:
        raise click.ClickException(f"Unsupported output extension: {suffix}")


if __name__ == "__main__":
    main()
