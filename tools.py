import subprocess


def webpage_capture(
    url: str, x: int = 0, y: int = 0, width: int = 800, height: int = 600
) -> str:
    """capture the webpage and return the screen short path saved in the host

    Args:
        url (str): the URL of the webpage to capture
        x (int): x coordinate of the screenshot area (default 0)
        y (int): y coordinate of the screenshot area (default 0)
        width (int): width of the screenshot area (default 800)
        height (int): height of the screenshot area (default 600)
    Returns:
        str: the screen short path saved in the host
    """
    print(f"running webpage_capture()")
    if url:
        print(f"Received URL: {url}")

    # call node.js script to capture the webpage
    try:
        result = subprocess.run(
            ["node", "capture_url.js", url, str(x), str(y), str(width), str(height)],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return f"Error capturing webpage: {e.stderr.strip()}"


def webpage_save_to_html(url: str) -> str:
    """Save a webpage as an offline snapshot directory and return index.html path.

    Args:
        url (str): the URL of the webpage to snapshot.

    Returns:
        str: the saved snapshot entry path, such as
            html/<timestamp>_<url_slug>/index.html
    """
    print("running webpage_save_to_html()")
    if url:
        print(f"Received URL: {url}")

    try:
        result = subprocess.run(
            ["node", "url_save_as_html.js", url],
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return f"Error saving webpage snapshot: {e.stderr.strip()}"


def run_cmd(command: str) -> str:
    """run a Linux command in the host.
    The command can be any valid Linux command.
    such as, run a command like `ls -l /home/user` to list the files in the directory "/home/user".
    or run a command like `cd /home/user && ls -l` to change directory to "/home/user" and list the files in the directory.
    or run a command like `curl https://www.example.com` to fetch the content of a webpage.
    or run a command like `cat /app/html/index.html` to read the content of a file.
    or run a command like `python -c "print(1+1)"` to run a Python script, it will return "2"
    or run a python command like `python -c "print('strawberry'.count('r'))"` to count the number of occurrences of the letter 'r' in the string "strawberry", it will return "3".

    Args:
        command (str): the command to run

    Returns:
        str: the output of the command
    """
    print(f"Running command: {command}")
    # command_list = command.split() if isinstance(command, str) else command
    # if not isinstance(command, list):
    #     return "Error: command must be a string or a list of strings."
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, check=True
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        return f"Error: {e.stderr.strip()}"


if __name__ == "__main__":
    # print(webpage_capture("https://www.baidu.com"))
    run_cmd("ls -lrt . | wc -l ")  # Example command to list files in a directory

# This code can be used to get the host information in a structured format.
# It can be integrated into a larger application or used standalone.
# The output will be a JSON string containing the system information.
